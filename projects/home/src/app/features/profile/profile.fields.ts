import { ThemePreference } from '../../core/theme/theme.service';

/** A row on the Profile screen; one dialog edits one of these. */
export type ProfileFieldKey =
  | 'fullName'
  | 'phone'
  | 'email'
  | 'userRole'
  | 'village'
  | 'location'
  | 'pincode'
  | 'preferredLanguage'
  | 'theme';

/** One input inside a field's dialog. `name` is the profile key it saves to. */
export interface ProfileControl {
  name:
    | 'fullName'
    | 'email'
    | 'userRole'
    | 'village'
    | 'district'
    | 'state'
    | 'pincode'
    | 'preferredLanguage'
    | 'theme';
  kind: 'text' | 'email' | 'numeric' | 'select';
  labelKey: string;
  required?: boolean;
}

export interface ProfileField {
  key: ProfileFieldKey;
  labelKey: string;
  helpKey?: string;
  readonly?: boolean;
  controls: ProfileControl[];
}

export interface ProfileGroup {
  titleKey: string;
  fields: ProfileField[];
}

export const PROFILE_ROLES = [
  'Farmer',
  'Farm Owner',
  'Agronomist',
  'Farm Worker',
  'Student',
  'Researcher',
  'Gardener',
] as const;

export const PROFILE_THEMES: ThemePreference[] = ['system', 'light', 'dark'];

const text = (
  name: ProfileControl['name'],
  labelKey: string,
  kind: ProfileControl['kind'] = 'text',
  required = false,
): ProfileControl => ({ name, kind, labelKey, required });

export const PROFILE_GROUPS: ProfileGroup[] = [
  {
    titleKey: 'profile.groups.account',
    fields: [
      {
        key: 'fullName',
        labelKey: 'profile.fullName',
        helpKey: 'profile.help.fullName',
        controls: [text('fullName', 'profile.fullName', 'text', true)],
      },
      { key: 'phone', labelKey: 'profile.phoneNumber', readonly: true, controls: [] },
      {
        key: 'email',
        labelKey: 'profile.emailAddress',
        helpKey: 'profile.help.email',
        controls: [text('email', 'profile.emailAddress', 'email')],
      },
      {
        key: 'userRole',
        labelKey: 'profile.userRole',
        helpKey: 'profile.help.userRole',
        controls: [text('userRole', 'profile.userRole', 'select')],
      },
    ],
  },
  {
    titleKey: 'profile.groups.location',
    fields: [
      {
        key: 'village',
        labelKey: 'profile.village',
        helpKey: 'profile.help.village',
        controls: [text('village', 'profile.village')],
      },
      {
        key: 'location',
        labelKey: 'profile.districtState',
        helpKey: 'profile.help.location',
        controls: [text('district', 'profile.district'), text('state', 'profile.state')],
      },
      {
        key: 'pincode',
        labelKey: 'profile.pincode',
        helpKey: 'profile.help.pincode',
        controls: [text('pincode', 'profile.pincode', 'numeric')],
      },
    ],
  },
  {
    titleKey: 'profile.groups.app',
    fields: [
      {
        key: 'preferredLanguage',
        labelKey: 'profile.language',
        helpKey: 'profile.help.language',
        controls: [text('preferredLanguage', 'profile.language', 'select')],
      },
      {
        key: 'theme',
        labelKey: 'profile.theme',
        helpKey: 'profile.help.theme',
        controls: [text('theme', 'profile.theme', 'select')],
      },
    ],
  },
];

/** Fields that prompt the "details left" banner when empty, in the order they are offered. */
export const PROFILE_REQUIRED: ProfileFieldKey[] = ['email', 'village', 'location', 'pincode'];

export function findProfileField(key: ProfileFieldKey): ProfileField | undefined {
  return PROFILE_GROUPS.flatMap((group) => group.fields).find((field) => field.key === key);
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const PINCODE_PATTERN = /^\d{6}$/;

/** The error message key for a control's value, or '' when it is valid. */
export function profileControlError(control: ProfileControl, raw: string): string {
  const value = raw.trim();
  if (control.required && !value) return 'profile.errors.nameRequired';
  if (control.name === 'email' && value && !EMAIL_PATTERN.test(value)) {
    return 'profile.errors.emailInvalid';
  }
  if (control.name === 'pincode' && value && !PINCODE_PATTERN.test(value)) {
    return 'profile.errors.pincodeInvalid';
  }
  return '';
}
