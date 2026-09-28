"use client"

import { useEffect } from "react"
import { UI_TRANSLATIONS, translateUiText, type UiLocale } from "@/lib/ui-translations"
import { translateUiExtension, type ExtendedUiLocale } from "@/lib/ui-translation-extensions"
import { translateCompleteUi } from "@/lib/ui-translation-complete"
import {
  LANGUAGE_APPLIED_EVENT,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_SOURCE_KEY,
  deviceUiLocale,
  initialUiLocale,
  parseUiLocale,
  persistUiLocale,
} from "@/lib/locale-preferences"
import {
  LANGUAGE_APPLIED_EVENT,
  LANGUAGE_CHANGE_EVENT,
  deviceAppLocale,
  initialAppLocale,
  parseAppLocale,
  persistAppLocale,
  storedLocaleSource,
  type LocaleSource,
} from "@/lib/locale"
const originalText = new WeakMap<Text, string>()
const renderedText = new WeakMap<Text, string>()
const originalAttributes = new WeakMap<Element, Map<string, string>>()
const renderedAttributes = new WeakMap<Element, Map<string, string>>()
const attributes = ["placeholder", "aria-label", "aria-description", "title", "alt"] as const

const canonicalUiText = new Map<string, string>()
for (const [nl, row] of Object.entries(UI_TRANSLATIONS)) {
  canonicalUiText.set(nl, nl)
  canonicalUiText.set(row.fr, nl)
  canonicalUiText.set(row.en, nl)
}

function canonicalizeBase(value: string) {
  const exact = canonicalUiText.get(value)
  if (exact) return exact
  const separators = /(\s+(?:·|→|—)\s+|:\s+)/
  const parts = value.split(separators)
  if (parts.length <= 1) return value
  let changed = false
  const canonical = parts.map(part => {
    if (separators.test(part)) return part
    const trimmed = part.trim()
    const hit = canonicalUiText.get(trimmed)
    if (!hit) return part
    changed = true
    const leading = part.match(/^\s*/)?.[0] || ""
    const trailing = part.match(/\s*$/)?.[0] || ""
    return leading + hit + trailing
  }).join("")
  return changed ? canonical : value
}

function translate(value: string, locale: ExtendedUiLocale): string {
  const counted = value.match(/^(\d+)\s+(.+)$/)
  if (counted) {
    const translatedTail: string = translate(counted[2], locale)
    if (translatedTail !== counted[2]) return `${counted[1]} ${translatedTail}`
  }

  const complete = translateCompleteUi(value, locale)
  if (complete !== value) return complete
  const extension = translateUiExtension(value, locale)
  if (extension !== value) return extension
  const canonical = canonicalizeBase(value)
  const completeCanonical = translateCompleteUi(canonical, locale)
  if (completeCanonical !== canonical) return completeCanonical
  const extendedCanonical = translateUiExtension(canonical, locale)
  if (extendedCanonical !== canonical) return extendedCanonical
  if (locale === "de") return canonical
  return translateUiText(canonical, locale as UiLocale)
}

function isExcluded(node: Node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement
  return Boolean(element?.closest("[data-no-translate]"))
}

function translateTextNode(node: Text, locale: ExtendedUiLocale) {
  if (isExcluded(node)) return
  const current = node.nodeValue || ""
  if (!current.trim()) return
  const previousRendered = renderedText.get(node)
  if (!originalText.has(node) || (previousRendered !== undefined && current !== previousRendered)) originalText.set(node, current)
  const original = originalText.get(node) || current
  const leading = original.match(/^\s*/)?.[0] || ""
  const trailing = original.match(/\s*$/)?.[0] || ""
  const next = `${leading}${translate(original.trim(), locale)}${trailing}`
  renderedText.set(node, next)
  if (node.nodeValue !== next) node.nodeValue = next
}

function translateElementAttributes(element: Element, locale: ExtendedUiLocale) {
  if (element.closest("[data-no-translate]")) return
  let originals = originalAttributes.get(element)
  if (!originals) { originals = new Map<string, string>(); originalAttributes.set(element, originals) }
  let rendered = renderedAttributes.get(element)
  if (!rendered) { rendered = new Map<string, string>(); renderedAttributes.set(element, rendered) }
  for (const attribute of attributes) {
    if (!element.hasAttribute(attribute)) continue
    const current = element.getAttribute(attribute) || ""
    const previousRendered = rendered.get(attribute)
    if (!originals.has(attribute) || (previousRendered !== undefined && current !== previousRendered)) originals.set(attribute, current)
    const original = originals.get(attribute) || current
    const translated = translate(original, locale)
    rendered.set(attribute, translated)
    if (current !== translated) element.setAttribute(attribute, translated)
  }
}

function translateNode(root: Node, locale: ExtendedUiLocale) {
  if (isExcluded(root)) return
  if (root.nodeType === Node.TEXT_NODE) { translateTextNode(root as Text, locale); return }
  if (!(root instanceof Element) && root !== document.body) return
  if (root instanceof Element) translateElementAttributes(root, locale)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) { translateTextNode(node as Text, locale); node = walker.nextNode() }
  if (root instanceof Element) root.querySelectorAll("*").forEach(element => translateElementAttributes(element, locale))
}

export function LocaleSync() {
  useEffect(() => {
    let locale = initialAppLocale() as ExtendedUiLocale
    let applying = false
    const applyLocale = (nextLocale: ExtendedUiLocale, source: LocaleSource) => {
      locale = nextLocale
      document.documentElement.lang = locale
      persistAppLocale(locale, source)
      applying = true
      translateNode(document.body, locale)
      const path = window.location.pathname
      const portal = path.startsWith("/login/admin")
        ? (locale === "fr" ? "Connexion administrateur" : locale === "en" ? "Administrator login" : locale === "de" ? "Administrator-Anmeldung" : "Beheerder inloggen")
        : path.startsWith("/login/responsible")
          ? (locale === "fr" ? "Connexion responsable" : locale === "en" ? "Responsible login" : locale === "de" ? "Verantwortlichen-Anmeldung" : "Verantwoordelijke inloggen")
          : path.startsWith("/login")
            ? (locale === "fr" ? "Connexion personnel" : locale === "en" ? "Staff login" : locale === "de" ? "Personal-Anmeldung" : "Personeel inloggen")
            : (locale === "fr" ? "UP TILL DAWN Personnel" : locale === "en" ? "UP TILL DAWN Staff" : locale === "de" ? "UP TILL DAWN Personal" : "UP TILL DAWN Personeel")
      document.title = path.startsWith("/login") ? `${portal} | UP TILL DAWN Crew` : portal
      const description = locale === "fr"
        ? "Gestion des équipes et du personnel pour les événements Up Till Dawn."
        : locale === "en"
          ? "Crew and staff management for Up Till Dawn events."
          : locale === "de"
            ? "Crew- und Personalverwaltung für Up Till Dawn Veranstaltungen."
            : "Crew- en personeelsbeheer voor Up Till Dawn-evenementen."
      document.querySelectorAll('meta[name="description"],meta[property="og:description"]').forEach(meta=>meta.setAttribute("content",description))
      window.dispatchEvent(new CustomEvent(LANGUAGE_APPLIED_EVENT,{detail:locale}))
      applying = false
    }
    applyLocale(locale, storedLocaleSource()==='manual'?'manual':'device')
    const observer = new MutationObserver(mutations => {
      if (applying) return
      applying = true
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateNode(mutation.target, locale)
        else if (mutation.type === "attributes") translateElementAttributes(mutation.target as Element, locale)
        else mutation.addedNodes.forEach(node => translateNode(node, locale))
      }
      applying = false
    })
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes] })
    const onLanguageChange = (event: Event) => {
      const next=parseAppLocale((event as CustomEvent<string>).detail) || 'nl'
      applyLocale(next as ExtendedUiLocale,'manual')
    }
    const onDeviceLanguageChange = () => {
      if(storedLocaleSource()==='manual')return
      applyLocale(deviceAppLocale() as ExtendedUiLocale,'device')
    }
    window.addEventListener(LANGUAGE_CHANGE_EVENT, onLanguageChange)
    window.addEventListener("languagechange", onDeviceLanguageChange)
    return () => {
      observer.disconnect()
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, onLanguageChange)
      window.removeEventListener("languagechange", onDeviceLanguageChange)
    }
  }, [])
  return null
}
