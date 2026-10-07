export type VisaId = 'tourist' | 'family';
export type DocSlotId = 'passport' | 'photo' | 'ticket' | 'hotel' | 'insurance' | 'bank' | 'sponsor_id' | 'tenancy' | 'salary' | 'relationship';
export type Relationship = 'spouse' | 'parent' | 'child' | 'sibling' | 'friend';
export type Emirate = 'Dubai' | 'Abu Dhabi' | 'Sharjah' | 'Ras Al Khaimah';

export interface Answers {
  nationality: string;
  hasPermit: boolean | null;
  visa: VisaId;
  days: 30 | 60;
  arrival: string;
  departure: string;
  emirate: Emirate;
  relationship: Relationship;
}

export interface Sponsor {
  name: string;
  emiratesId: string;
  eidExpires: string;
  phone: string;
  salaryAED: number;
  tenancyExpires: string;
  address: string;
}

export interface Profile {
  given: string;
  surname: string;
  dob: string;
  sex: 'M' | 'F' | '';
  birthplace: string;
  passportNo: string;
  passportIssued: string;
  passportExpires: string;
  passportPlace: string;
  email: string;
  phone: string;
  address: string;
  profession: string;
  marital: string;
  flightNo: string;
  arrivalDate: string;
  arrivalTime: string;
  ticketName: string;
  hotelName: string;
  hotelCheckIn: string;
  hotelCheckOut: string;
  insurer: string;
  policyNo: string;
  insuranceName: string;
  insuranceFrom: string;
  insuranceTo: string;
  sponsor: Sponsor | null;
}

export interface FileRef {
  slot: DocSlotId;
  name: string;
  bytes: number;
  mime: string;
  sample: boolean;
  url?: string;
  blob?: Blob;
  width?: number;
  height?: number;
}

export interface DocField {
  key: string;
  label: string;
  value: string;
  confidence: number;
}

export type Risk = 'low' | 'medium' | 'high';

export interface IssueOption {
  id: string;
  label: string;
  detail: string;
  recommended?: boolean;
}

export interface Issue {
  id: string;
  rule: string;
  risk: Risk;
  title: string;
  detail: string;
  evidence: { label: string; value: string }[];
  options: IssueOption[];
  kind?: 'photo';
}

export type PortalPageId =
  | 'home'
  | 'register'
  | 'verify'
  | 'personal'
  | 'passport'
  | 'travel'
  | 'sponsor'
  | 'contact'
  | 'uploads'
  | 'declarations'
  | 'review'
  | 'sponsor_wait'
  | 'payment'
  | 'bank'
  | 'done'
  | 'status';
