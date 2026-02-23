export type UserRole = 'admin' | 'staff' | 'client';

export interface User {
  key: string;
  empId?: string;
  name: string;
  username: string;
  password: string;
  role: UserRole;
  projects?: string[];
  projectKey?: string;
  phone?: string;
  active: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface Project {
  key: string;
  code: string;
  name: string;
  client: string;
  contact?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  radius?: number;
  gpsEnabled?: boolean;
  active: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface CustomFormField {
  id: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'textarea' | 'date' | 'time' | 'signature' | 'table';
  label: string;
  required?: boolean;
  options?: string[];        // for select
  tableColumns?: string[];   // for table type
  defaultValue?: string;
  placeholder?: string;
}

export interface CustomForm {
  key: string;
  name: string;
  icon: string;
  description?: string;
  fields: CustomFormField[];
  active: boolean;
  isBuiltIn?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface IPMRecord {
  key: string;
  formType: string;
  projectKey: string;
  userKey: string;
  date: string;
  time?: string;
  remarks?: string;
  createdAt?: number;
  // Attendance
  timeIn?: string;
  timeOut?: string;
  work?: string;
  location?: {
    lat: number;
    lng: number;
    distance: number;
    verified: boolean;
    skipped: boolean;
  };
  // Insecticide
  chemical?: string;
  qty?: string;
  water?: string;
  batchNumber?: string;
  remainingQty?: string;
  areas?: string[];
  // Checklist
  activities?: { item: string; status: string }[];
  // Generic entries
  entries?: {
    sr: number;
    location: string;
    count?: number;
    status?: string;
    stationType?: string;
    baitConsumed?: string;
    baitReplaced?: string;
    condition?: string;
    pestActivity?: string;
    [key: string]: unknown;
  }[];
  // Bait station
  totalStations?: number;
  activeStations?: number;
  baitUsed?: string;
  baitBrand?: string;
  // Signatures
  techSignature?: string;
  clientSignature?: string;
  supervisorSignature?: string;
  // Custom form data
  customData?: Record<string, unknown>;
}

export interface Remark {
  key: string;
  text: string;
  userKey: string;
  projectKey: string;
  createdAt: number;
  read?: boolean;
}

export type Page = 'dashboard' | 'dataentry' | 'records' | 'staff' | 'clients' | 'projects' | 'remarks' | 'settings' | 'reports' | 'formbuilder';

export type FormType = 'attendance' | 'insecticide' | 'gluebox' | 'efk' | 'lizard' | 'cat' | 'snake' | 'checklist' | 'baitstation' | string;
