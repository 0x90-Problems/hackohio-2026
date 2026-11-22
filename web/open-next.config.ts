// Cloudflare hosting (NSB-84). Every page and route is dynamic and passes requests on to the AWS
// services, so no incremental cache is configured: nothing is cached between requests.
import { defineCloudflareConfig } from "@opennextjs/cloudflare"

export default defineCloudflareConfig({})
