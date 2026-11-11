import type { ShipmentStatus } from "./constants";
import { AUCTIONS } from "./constants";

export type AuctionHouse = (typeof AUCTIONS)[number] | "OTHER";

export type TrackingEvent = {
  status: ShipmentStatus;
  title: string;
  description?: string;
  country?: string;
  port?: string;
  occurredAt: string;
};

export type TrackingDocument = {
  title: string;
  type: string;
  url: string;
};

export type TrackingPhoto = {
  id?: string;
  url: string;
  caption?: string;
  category?: string;
};

export type NotifyChannelResult = {
  sent: boolean;
  outcome?: "accepted" | "failed" | "unknown";
  error?: string;
};

export type NotifyInfo = {
  sent: boolean;
  channel?: string;
  error?: string;
  channelResults?: { whatsapp?: NotifyChannelResult; sms?: NotifyChannelResult };
};

export type PhotoNotificationInfo = {
  queued: boolean;
  pendingPhotos?: number;
  dueAt?: string;
  error?: "enqueue_failed";
};

export type TransitStop = {
  place: string;
  occurredAt?: string;
};

export type TrackingShipment = {
  id?: string;
  lookupType?: "vin" | "lot";
  trackingCode: string;
  vin: string;
  make?: string;
  model?: string;
  year?: number;
  lotNumber?: string;
  auctionHouse: AuctionHouse | "OTHER";
  originCountry?: "USA" | "KOREA" | "CHINA" | "OTHER" | null;
  freightPaymentStatus?: "UNPAID" | "PARTIAL" | "PAID";
  documentMethod?: "UNSET" | "POWER_OF_ATTORNEY" | "SIGNIFY";
  documentStatus?: "PENDING" | "COMPLETED";
  purchasePaymentPercent?: number | null;
  commissionUsd?: number | null;
  containerOpeningDate?: string | null;
  reviewToken?: string;
  review?: { rating: number; comment?: string | null; createdAt: string } | null;
  containerNumber?: string;
  carrierCode?: string;
  carrierName?: string;
  vesselName?: string;
  vesselImo?: string;
  voyageNumber?: string;
  carrierTrackingUrl?: string;
  containerStatus?: string;
  lat?: number;
  lng?: number;
  mapLat?: number;
  mapLng?: number;
  originPort?: string;
  destinationPort?: string;
  currentCountry?: string;
  currentPort?: string;
  transitPorts?: TransitStop[];
  currentTransitIndex?: number;
  eta?: string;
  currentStatus: ShipmentStatus;
  deliveredAt?: string;
  customerName: string;
  customerPhone?: string;
  adminNotes?: string;
  events: TrackingEvent[];
  documents: TrackingDocument[];
  photos: TrackingPhoto[];
  invoice?: { number: string; amountUsd: number; status: string };
  customsStatus?: string;
  hasInsurance?: boolean;
  contract?: {
    signed: boolean;
    status?: string;
    kind?: string | null;
    publicUrl?: string | null;
  };
  insurance?: {
    firstName?: string;
    lastName?: string;
    docSeries?: string;
    trustee?: string;
    amountUsd?: string;
    amountAzn?: string;
    status?: string;
    notifiedAt?: string;
    paidOutAt?: string;
    receiptToken?: string;
    receiptUrl?: string;
  };
};

export type VinRecord = {
  vin: string;
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
  mileage?: number;
  fuel?: string;
  transmission?: string;
  exteriorColor?: string;
  interiorColor?: string;
  bodyStyle?: string;
  auctionHouse?: string;
  saleDate?: string;
  damageHistory?: string;
  photos: string[];
  auctionPhotos: string[];
  status?: string;
  specs?: Record<string, string>;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF" | "FREIGHT_USER" | "CUSTOMER";
  locale: string;
};
