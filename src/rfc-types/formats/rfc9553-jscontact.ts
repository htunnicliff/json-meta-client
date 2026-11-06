/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { JsonValue, RequireAtLeastOne } from "type-fest";

// cspell:words jyut textphone

/** @see https://www.rfc-editor.org/info/rfc9553/#section-1.8 */
export type VendorExtension = `${string}:${string}`;

interface JSContactObject {
  [property: VendorExtension]: unknown;
}

/**
 * Paths are relative JSON Pointers without the leading slash. A null value removes
 * a property; array elements may be replaced, but cannot be inserted or removed.
 * @see https://www.rfc-editor.org/info/rfc9553/#section-1.4.3
 */
export interface PatchObject {
  [path: string]: JsonValue;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-1.5.1 */
export type Context = "private" | "work" | VendorExtension;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-1.5.4 */
export type PhoneticSystem = "ipa" | "jyut" | "piny" | VendorExtension;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-1.4.4 */
export interface Resource extends JSContactObject {
  "@type"?: "Calendar" | "CryptoKey" | "Directory" | "Link" | "Media" | VendorExtension;
  kind?: string;
  uri: string;
  mediaType?: string;
  contexts?: Partial<Record<Context, boolean>>;
  /** An integer from 1 (most preferred) to 100. */
  pref?: number;
  label?: string;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.1.4 */
export type CardKind =
  | "individual"
  | "group"
  | "org"
  | "location"
  | "device"
  | "application"
  | VendorExtension;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2 */
export interface Card extends JSContactObject {
  "@type": "Card";
  version: "1.0";
  uid: string;
  created?: string;
  kind?: CardKind;
  language?: string;
  /** Only valid when kind is "group"; keys are member Card uid values. */
  members?: { [uid: string]: true };
  prodId?: string;
  relatedTo?: { [uid: string]: Relation };
  updated?: string;
  name?: Name;
  nicknames?: { [id: string]: Nickname };
  organizations?: { [id: string]: Organization };
  speakToAs?: SpeakToAs;
  titles?: { [id: string]: Title };
  emails?: { [id: string]: EmailAddress };
  onlineServices?: { [id: string]: OnlineService };
  phones?: { [id: string]: Phone };
  preferredLanguages?: { [id: string]: LanguagePref };
  calendars?: { [id: string]: Calendar };
  schedulingAddresses?: { [id: string]: SchedulingAddress };
  addresses?: { [id: string]: Address };
  cryptoKeys?: { [id: string]: CryptoKey };
  directories?: { [id: string]: Directory };
  links?: { [id: string]: Link };
  media?: { [id: string]: Media };
  /** Language tags map to patches, which must not target localizations itself. */
  localizations?: { [language: string]: PatchObject };
  anniversaries?: { [id: string]: Anniversary };
  keywords?: { [keyword: string]: true };
  notes?: { [id: string]: Note };
  personalInfo?: { [id: string]: PersonalInfo };
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.1.8 */
export type RelationType =
  | "acquaintance"
  | "agent"
  | "child"
  | "co-resident"
  | "co-worker"
  | "colleague"
  | "contact"
  | "crush"
  | "date"
  | "emergency"
  | "friend"
  | "kin"
  | "me"
  | "met"
  | "muse"
  | "neighbor"
  | "parent"
  | "sibling"
  | "spouse"
  | "sweetheart"
  | VendorExtension;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.1.8 */
export interface Relation extends JSContactObject {
  "@type"?: "Relation";
  relation?: Partial<Record<RelationType, true>>;
}

interface NameProperties extends JSContactObject {
  "@type"?: "Name";
  /** Must contain at least one component whose kind is not "separator". */
  components?: NameComponent[];
  isOrdered?: boolean;
  /** Only valid with ordered components. */
  defaultSeparator?: string;
  full?: string;
  /** Only valid with components; keys must match an existing component kind. */
  sortAs?: Partial<Record<NameComponentKind, string>>;
  phoneticScript?: string;
  phoneticSystem?: PhoneticSystem;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.2.1.1 */
export type Name = RequireAtLeastOne<NameProperties, "components" | "full">;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.2.1.2 */
export type NameComponentKind =
  | "title"
  | "given"
  | "given2"
  | "surname"
  | "surname2"
  | "credential"
  | "generation"
  | "separator"
  | VendorExtension;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.2.1.2 */
export interface NameComponent extends JSContactObject {
  "@type"?: "NameComponent";
  value: string;
  kind: NameComponentKind;
  /** Requires phoneticScript or phoneticSystem on the containing Name. */
  phonetic?: string;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.2.2 */
export interface Nickname extends JSContactObject {
  "@type"?: "Nickname";
  name: string;
  contexts?: Partial<Record<Context, boolean>>;
  pref?: number;
}

interface OrganizationProperties extends JSContactObject {
  "@type"?: "Organization";
  name?: string;
  /** A nonempty list, ordered from highest to lowest organizational level. */
  units?: OrgUnit[];
  sortAs?: string;
  contexts?: Partial<Record<Context, boolean>>;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.2.3 */
export type Organization = RequireAtLeastOne<OrganizationProperties, "name" | "units">;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.2.3 */
export interface OrgUnit extends JSContactObject {
  "@type"?: "OrgUnit";
  name: string;
  sortAs?: string;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.2.4 */
export type GrammaticalGender =
  | "animate"
  | "common"
  | "feminine"
  | "inanimate"
  | "masculine"
  | "neuter"
  | VendorExtension;

interface SpeakToAsProperties extends JSContactObject {
  "@type"?: "SpeakToAs";
  grammaticalGender?: GrammaticalGender;
  pronouns?: { [id: string]: Pronouns };
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.2.4 */
export type SpeakToAs = RequireAtLeastOne<SpeakToAsProperties, "grammaticalGender" | "pronouns">;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.2.4 */
export interface Pronouns extends JSContactObject {
  "@type"?: "Pronouns";
  pronouns: string;
  contexts?: Partial<Record<Context, boolean>>;
  pref?: number;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.2.5 */
export interface Title extends JSContactObject {
  "@type"?: "Title";
  name: string;
  kind?: "title" | "role" | VendorExtension;
  organizationId?: string;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.3.1 */
export interface EmailAddress extends JSContactObject {
  "@type"?: "EmailAddress";
  address: string;
  contexts?: Partial<Record<Context, boolean>>;
  pref?: number;
  label?: string;
}

interface OnlineServiceProperties extends JSContactObject {
  "@type"?: "OnlineService";
  service?: string;
  uri?: string;
  user?: string;
  contexts?: Partial<Record<Context, boolean>>;
  pref?: number;
  label?: string;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.3.2 */
export type OnlineService = RequireAtLeastOne<OnlineServiceProperties, "uri" | "user">;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.3.3 */
export type PhoneFeature =
  | "mobile"
  | "voice"
  | "text"
  | "video"
  | "main-number"
  | "textphone"
  | "fax"
  | "pager"
  | VendorExtension;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.3.3 */
export interface Phone extends JSContactObject {
  "@type"?: "Phone";
  number: string;
  features?: Partial<Record<PhoneFeature, true>>;
  contexts?: Partial<Record<Context, boolean>>;
  pref?: number;
  label?: string;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.3.4 */
export interface LanguagePref extends JSContactObject {
  "@type"?: "LanguagePref";
  language: string;
  contexts?: Partial<Record<Context, boolean>>;
  pref?: number;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.4.1 */
export interface Calendar extends Resource {
  "@type"?: "Calendar";
  kind: "calendar" | "freeBusy" | VendorExtension;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.4.2 */
export interface SchedulingAddress extends JSContactObject {
  "@type"?: "SchedulingAddress";
  uri: string;
  contexts?: Partial<Record<Context, boolean>>;
  pref?: number;
  label?: string;
}

interface AddressProperties extends JSContactObject {
  "@type"?: "Address";
  /** Must contain at least one component whose kind is not "separator". */
  components?: AddressComponent[];
  isOrdered?: boolean;
  countryCode?: string;
  coordinates?: string;
  timeZone?: string;
  contexts?: Partial<Record<Context | "billing" | "delivery", true>>;
  full?: string;
  /** Only valid with ordered components. */
  defaultSeparator?: string;
  pref?: number;
  phoneticScript?: string;
  phoneticSystem?: PhoneticSystem;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.5.1.1 */
export type Address = RequireAtLeastOne<
  AddressProperties,
  "components" | "coordinates" | "countryCode" | "full" | "timeZone"
>;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.5.1.2 */
export type AddressComponentKind =
  | "room"
  | "apartment"
  | "floor"
  | "building"
  | "number"
  | "name"
  | "block"
  | "subdistrict"
  | "district"
  | "locality"
  | "region"
  | "postcode"
  | "country"
  | "direction"
  | "landmark"
  | "postOfficeBox"
  | "separator"
  | VendorExtension;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.5.1.2 */
export interface AddressComponent extends JSContactObject {
  "@type"?: "AddressComponent";
  value: string;
  kind: AddressComponentKind;
  /** Requires phoneticScript or phoneticSystem on the containing Address. */
  phonetic?: string;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.6.1 */
export interface CryptoKey extends Resource {
  "@type"?: "CryptoKey";
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.6.2 */
export interface Directory extends Resource {
  "@type"?: "Directory";
  kind: "directory" | "entry" | VendorExtension;
  listAs?: number;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.6.3 */
export interface Link extends Resource {
  "@type"?: "Link";
  kind?: "contact" | VendorExtension;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.6.4 */
export interface Media extends Resource {
  "@type"?: "Media";
  kind: "photo" | "sound" | "logo" | VendorExtension;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.8.1 */
export interface Anniversary extends JSContactObject {
  "@type"?: "Anniversary";
  kind: "birth" | "death" | "wedding" | VendorExtension;
  /** PartialDate is implied; a Timestamp must explicitly identify its type. */
  date: (PartialDate & { utc?: never }) | (Timestamp & { "@type": "Timestamp" });
  place?: Address;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.8.1 */
export interface PartialDate extends JSContactObject {
  "@type"?: "PartialDate";
  year?: number;
  /** An integer from 1 to 12; requires year or day. */
  month?: number;
  /** A valid day of the given month and year; requires month. */
  day?: number;
  calendarScale?: string;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.8.1 */
export interface Timestamp extends JSContactObject {
  "@type"?: "Timestamp";
  utc: string;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.8.3 */
export interface Note extends JSContactObject {
  "@type"?: "Note";
  note: string;
  created?: string;
  author?: Author;
}

interface AuthorProperties extends JSContactObject {
  "@type"?: "Author";
  name?: string;
  uri?: string;
}

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.8.3 */
export type Author = RequireAtLeastOne<AuthorProperties, "name" | "uri">;

/** @see https://www.rfc-editor.org/info/rfc9553/#section-2.8.4 */
export interface PersonalInfo extends JSContactObject {
  "@type"?: "PersonalInfo";
  kind: "expertise" | "hobby" | "interest" | VendorExtension;
  value: string;
  level?: "high" | "medium" | "low" | VendorExtension;
  listAs?: number;
  label?: string;
}
