import type { LucideIcon } from "lucide-react"
import {adminAdministrationSubtabs,adminAdministrationLabel,adminAdministrationHref} from "@/lib/admin-administration-navigation"
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  MapPin,
  MessageCircle,
  PackageOpen,
  Boxes,
  ScrollText,
  ShoppingCart,
  Settings,
  CircleHelp,
  UserCheck,
  Users,
  Music,
  FileSignature,
  CalendarClock,
  ShieldCheck,
  ClipboardCheck,
  Truck,
  ShieldBan,
  Contact,
  Handshake,
  Megaphone,
  Wallet,
  Receipt,
  Landmark,
  Ticket,
  ChartNoAxesColumn,
  FolderOpen,
} from "lucide-react"

export type NavigationItem = {
  key: string
  href: string
  label: string
  icon: LucideIcon
  roles: string[]
}

const ADMIN_SUBTAB_ICONS:Record<string,LucideIcon>={
 "admin-artists":Music,
 "admin-contracts":FileSignature,
 "admin-rosters":CalendarClock,
 "admin-permits":ShieldCheck,
 "admin-timesheets":ClipboardCheck,
 "admin-logistics":Truck,
 "admin-promotion-tasks":ListChecks,
 "admin-promotion-discipline":ShieldBan,
 "admin-counterparties":Contact,
 "admin-sponsors":Handshake,
 "admin-marketing":Megaphone,
 "admin-finance":Wallet,
 "admin-invoices":Receipt,
 "admin-banking":Landmark,
 "admin-ticketing":Ticket,
 "admin-reports":ChartNoAxesColumn,
 "admin-documents":FolderOpen,
}
export const NAV_ITEMS: NavigationItem[] = [
  { key:"overview", href:"/", label:"Overzicht", icon:LayoutDashboard, roles:["employee","responsible_lead","admin"] },
  { key:"operations", href:"/operations", label:"Mijn werkuren", icon:Clock3, roles:["employee","responsible_lead","admin"] },
  { key:"events", href:"/events", label:"Evenementen", icon:CalendarDays, roles:["employee","responsible_lead","admin"] },
  { key:"workplaces", href:"/workplaces", label:"Werkplaatsen & shifts", icon:MapPin, roles:["employee","responsible_lead","admin"] },
  { key:"inventory", href:"/inventory", label:"Inventaris", icon:PackageOpen, roles:["employee","responsible_lead","admin"] },
  { key:"guestlist", href:"/guestlist", label:"Inkom & Guestlist", icon:ListChecks, roles:["employee","responsible_lead","admin"] },
  { key:"sales", href:"/sales", label:"Verkoop", icon:ShoppingCart, roles:["employee","responsible_lead","admin"] },
  { key:"shifts", href:"/shifts", label:"Diensten", icon:Clock3, roles:["employee","responsible_lead","admin"] },
  { key:"briefings", href:"/briefings", label:"Instructies", icon:ScrollText, roles:["employee","responsible_lead","admin"] },
  { key:"tasks", href:"/tasks", label:"Taken", icon:ListChecks, roles:["employee","responsible_lead","admin"] },
  { key:"chat", href:"/chat", label:"Chats", icon:MessageCircle, roles:["employee","responsible_lead","admin"] },
  { key:"crew", href:"/crew", label:"Personeel", icon:Users, roles:["employee","responsible_lead","admin"] },
  { key:"incidents", href:"/incidents", label:"Incidenten", icon:AlertTriangle, roles:["employee","responsible_lead","admin"] },
  { key:"exports", href:"/exports", label:"Excel", icon:FileSpreadsheet, roles:["admin"] },
  { key:"personnel", href:"/personnel", label:"Goedkeuringen", icon:UserCheck, roles:["admin"] },
  { key:"platform", href:"/admin/platform", label:"Platformbeheer", icon:Boxes, roles:["admin"] },
  { key:"help", href:"/help", label:"Help", icon:CircleHelp, roles:["employee","responsible_lead","admin"] },
  { key:"settings", href:"/settings", label:"Beheer", icon:Settings, roles:["employee","responsible_lead","admin"] },
 ...adminAdministrationSubtabs.map(item=>({
  key:item.key,
  href:adminAdministrationHref(item.key)!,
  label:adminAdministrationLabel(item.key,"nl")??item.slug,
  icon:ADMIN_SUBTAB_ICONS[item.key],
  roles:["admin"],
 })),
]
