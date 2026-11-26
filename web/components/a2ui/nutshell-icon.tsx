"use client"

// A2UI's Icon drawn with NutShell's icon set (NSB-90). A2UI's own Icon uses an icon font NutShell
// doesn't load (and its content policy blocks outside fonts), so it showed the icon's name as text.

import { createComponentImplementation } from "@a2ui/react"
import { IconApi } from "@a2ui/web_core/catalogs/basic/v1"
import {
  Accessibility, ArrowLeft, ArrowRight, Bell, BellOff, Calendar, CalendarDays, Camera, Check, CircleAlert, CircleHelp, CircleUser,
  CreditCard, Download, Ellipsis, EllipsisVertical, Eye, EyeOff, FastForward, Folder, Heart, HeartOff, House, Image, Info, Lock,
  LockOpen, Mail, MapPin, Menu, Paperclip, Pause, Pencil, Phone, Play, Plus, Printer, RefreshCw, Rewind, Search, Send, Settings,
  Share2, ShoppingCart, SkipBack, SkipForward, Square, Star, StarHalf, StarOff, Trash2, TriangleAlert, Upload, User, Volume1,
  Volume2, VolumeOff, VolumeX, X, type LucideIcon,
} from "lucide-react"

const ICONS: Record<string, LucideIcon> = {
  accessibility: Accessibility, accountCircle: CircleUser, add: Plus, arrowBack: ArrowLeft, arrowForward: ArrowRight,
  attachFile: Paperclip, calendarToday: Calendar, call: Phone, camera: Camera, check: Check, close: X, delete: Trash2,
  download: Download, edit: Pencil, event: CalendarDays, error: CircleAlert, fastForward: FastForward, favorite: Heart,
  favoriteOff: HeartOff, folder: Folder, help: CircleHelp, home: House, info: Info, locationOn: MapPin, lock: Lock,
  lockOpen: LockOpen, mail: Mail, menu: Menu, moreVert: EllipsisVertical, moreHoriz: Ellipsis, notificationsOff: BellOff,
  notifications: Bell, pause: Pause, payment: CreditCard, person: User, phone: Phone, photo: Image, play: Play, print: Printer,
  refresh: RefreshCw, rewind: Rewind, search: Search, send: Send, settings: Settings, share: Share2, shoppingCart: ShoppingCart,
  skipNext: SkipForward, skipPrevious: SkipBack, star: Star, starHalf: StarHalf, starOff: StarOff, stop: Square, upload: Upload,
  visibility: Eye, visibilityOff: EyeOff, volumeDown: Volume1, volumeMute: VolumeX, volumeOff: VolumeOff, volumeUp: Volume2,
  warning: TriangleAlert,
}

/** The lucide icon for an A2UI icon name, or null for a name it doesn't know. */
export function iconFor(name: unknown): LucideIcon | null {
  return typeof name === "string" ? (ICONS[name] ?? null) : null
}

// The renderer puts the @accessibility label on the element given accessibilityRef; without a
// label the icon is decoration.
export const NutshellIcon = createComponentImplementation(IconApi, ({ props, accessibilityRef }) => {
  const labelled = typeof props.accessibility?.label === "string"
  const Glyph = iconFor(props.name)
  if (!Glyph) return <span ref={accessibilityRef} aria-hidden={!labelled} role={labelled ? "img" : undefined} className="inline-block size-1.5 shrink-0 rounded-full bg-muted-foreground" />
  return <Glyph ref={accessibilityRef} className="size-4 shrink-0 text-muted-foreground" aria-hidden={!labelled} role={labelled ? "img" : undefined} />
})
