# Run once, by a person, from a machine that holds credentials for the account.
# It creates the trust that lets the pipeline log in, so it cannot itself run in
# the pipeline. The state is local: keep this directory.

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  description = "Where the bucket lives. The site holds no personal data, but keep it close to the users."
  type        = string
  default     = "eu-central-1"
}

variable "github_repository" {
  description = "The repository allowed to deploy, as owner/name."
  type        = string
  default     = "atlantic-blue/uni-schedule"
}

variable "site_name" {
  description = "Prefix for the bucket name."
  type        = string
  default     = "uni-schedule"
}

data "aws_caller_identity" "current" {}

# One account holds one provider for a given issuer, and account 230345688874
# already has this one. Creating a second is an error, so the default is to find
# the existing one. Set create_oidc_provider to true in an account that has none.
variable "create_oidc_provider" {
  description = "True only in an account with no GitHub OpenID Connect provider yet."
  type        = bool
  default     = false
}

resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

# GitHub now puts numeric identifiers in the subject, for example
# repo:owner@140661232/name@1331451420:ref:refs/heads/main. A condition written
# against the plain name alone refuses the job, so both shapes are accepted.
locals {
  oidc_provider_arn = var.create_oidc_provider ? one(aws_iam_openid_connect_provider.github[*].arn) : one(data.aws_iam_openid_connect_provider.github[*].arn)

  owner = split("/", var.github_repository)[0]
  name  = split("/", var.github_repository)[1]
  allowed_subjects = [
    "repo:${var.github_repository}:ref:refs/heads/main",
    "repo:${local.owner}@*/${local.name}@*:ref:refs/heads/main",
  ]
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.allowed_subjects
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.site_name}-deploy"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_s3_bucket" "site" {
  bucket = "${var.site_name}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.site_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "Work schedule"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "site"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    # Managed CachingOptimized.
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # The app keeps its state in the address, so a reload of /week must return the
  # single page rather than a not found from the bucket.
  dynamic "custom_error_response" {
    for_each = [403, 404]
    content {
      error_code         = custom_error_response.value
      response_code      = 200
      response_page_path = "/index.html"
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

data "aws_iam_policy_document" "bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.bucket.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }
  statement {
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }
  statement {
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "${var.site_name}-deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}

output "aws_deploy_role_arn" { value = aws_iam_role.deploy.arn }
output "aws_region" { value = var.region }
output "site_bucket" { value = aws_s3_bucket.site.bucket }
output "cloudfront_distribution_id" { value = aws_cloudfront_distribution.site.id }
output "site_url" { value = "https://${aws_cloudfront_distribution.site.domain_name}" }
