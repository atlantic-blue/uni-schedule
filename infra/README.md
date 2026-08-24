# Infrastructure

The site is static files in Amazon Simple Storage Service, served by CloudFront.
Supabase holds the data, so there is no server here.

Nothing is applied from a laptop except the bootstrap, once. Everything after
that runs in the pipeline.

## Order

1. **Bootstrap, once, by a person.** `infra/bootstrap` creates the OpenID Connect
   provider for GitHub and the role the deploy job assumes. It cannot run in
   continuous integration, because it creates the thing continuous integration
   logs in with. Its state is local, so keep the directory.

   ```
   cd infra/bootstrap
   terraform init
   terraform apply
   ```

   Account 230345688874 already holds a GitHub OpenID Connect provider, so
   `create_oidc_provider` stays false and Terraform reads the existing one. In an
   account with none, set it to true.

2. **Put the outputs into the repository.** In Settings, then Variables:
   `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `SITE_BUCKET`,
   `CLOUDFRONT_DISTRIBUTION_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

3. **Everything else deploys on merge to `main`.**

## The subject of the token

GitHub now issues tokens whose subject carries numeric identifiers, for example
`repo:owner@140661232/name@1331451420:ref:refs/heads/main`. A trust policy written
only against the plain name silently refuses the job. The policy here accepts
both forms. If a deploy fails with an access denied on assume role, read the real
subject out of CloudTrail rather than guessing at the pattern.
