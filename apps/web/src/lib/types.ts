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
  url: string;
  caption?: string;
  category?: string;
};

export type TransitStop = {
  place: string;
  occurredAt?: string;
};

export type TrackingShipment = {
  id?: string;
  trackingCode: string;
  vin: string;
  make?: string;
  model?: string;
  year?: number;
  auctionHouse: AuctionHouse | "OTHER";
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
  role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";
  locale: string;
};
