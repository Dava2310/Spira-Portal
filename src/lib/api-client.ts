import {
  AuthApi,
  Configuration,
  ContactsApi,
  DonationReceiptsApi,
  DonationsApi,
  HealthApi,
  ImpactFactorsApi,
  InventoryItemsApi,
  LocationPickupSlotsApi,
  LocationsApi,
  MeApi,
  PartnershipsApi,
  ProductsApi,
  RecipientPortalApi,
  RecipientVehiclesApi,
  RecipientsApi,
  RetailerPortalApi,
  RetailersApi,
  UsersApi,
} from '../api-client';
import { axiosInstance } from './axios';

const config = new Configuration({
  basePath: axiosInstance.defaults.baseURL,
});

/**
 * Every generated API class, bound to the one axios instance.
 *
 * Feature code calls these only through a `_logic` module, never directly — that
 * is what keeps the generated method names (`recipientPortalControllerClaim`) out
 * of components.
 *
 * `InvalidTokensApi` is deliberately absent: the denylist is an internal admin
 * surface and nothing in either portal should reach it.
 */
export const apiClient = {
  auth: new AuthApi(config, undefined, axiosInstance),
  me: new MeApi(config, undefined, axiosInstance),
  health: new HealthApi(config, undefined, axiosInstance),

  // Retailer side
  retailerPortal: new RetailerPortalApi(config, undefined, axiosInstance),
  inventoryItems: new InventoryItemsApi(config, undefined, axiosInstance),
  products: new ProductsApi(config, undefined, axiosInstance),
  donations: new DonationsApi(config, undefined, axiosInstance),

  // Recipient side
  recipientPortal: new RecipientPortalApi(config, undefined, axiosInstance),
  recipientVehicles: new RecipientVehiclesApi(config, undefined, axiosInstance),

  // Shared
  donationReceipts: new DonationReceiptsApi(config, undefined, axiosInstance),
  locations: new LocationsApi(config, undefined, axiosInstance),
  locationPickupSlots: new LocationPickupSlotsApi(
    config,
    undefined,
    axiosInstance,
  ),
  contacts: new ContactsApi(config, undefined, axiosInstance),
  partnerships: new PartnershipsApi(config, undefined, axiosInstance),
  retailers: new RetailersApi(config, undefined, axiosInstance),
  recipients: new RecipientsApi(config, undefined, axiosInstance),

  // Admin
  users: new UsersApi(config, undefined, axiosInstance),
  impactFactors: new ImpactFactorsApi(config, undefined, axiosInstance),
};
