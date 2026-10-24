import amazonwebservices from "@iconify-icons/simple-icons/amazonwebservices"
import github from "@iconify-icons/simple-icons/github"
import mongodb from "@iconify-icons/simple-icons/mongodb"
import redis from "@iconify-icons/simple-icons/redis"
import { Icon } from "@iconify/react/offline"

const BRAND_ICONS = {
  aws: amazonwebservices,
  github,
  mongodb,
  redis,
} as const

export type BrandIconName = keyof typeof BRAND_ICONS

export function BrandIcon({
  name,
  className = "size-4",
}: {
  name: BrandIconName
  className?: string
}) {
  return <Icon icon={BRAND_ICONS[name]} className={className} aria-hidden="true" />
}
