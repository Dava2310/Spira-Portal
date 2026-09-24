import type { ProductResponseDto } from '@/api-client';
import { ProductCategory, UnitOfMeasure } from '@/api-client';
import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';

// --- 1. TYPES (VM) ---

/**
 * A catalogue product, which a stock lot points at.
 *
 * Separate from the lot because the same product is logged over and over: the name,
 * brand, barcode and category belong to the product, while the quantity, expiry and
 * reason belong to the batch sitting on the shelf.
 */
export interface ProductVM {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  category: ProductCategory;
  imageUrl: string | null;
  defaultUnit: UnitOfMeasure | null;
  averageUnitWeightKg: number | null;
}

// --- 2. MAPPERS ---

/**
 * Maps a product onto the view model.
 * @param dto The product from the API.
 * @returns The product view model.
 */
export const toProductVM = (dto: ProductResponseDto): ProductVM => ({
  id: dto.id,
  name: dto.name,
  brand: dto.brand ?? null,
  barcode: dto.barcode ?? null,
  category: dto.category,
  imageUrl: dto.imageUrl ?? null,
  defaultUnit: dto.defaultUnit ?? null,
  averageUnitWeightKg: dto.averageUnitWeightKg ?? null,
});

/**
 * Finds the products worth showing for a typed term.
 *
 * Filtered here rather than server-side because a shop's catalogue is small and the
 * whole list is already loaded for the picker; a request per keystroke would be
 * slower than the filter.
 * @param products The retailer's catalogue.
 * @param term What has been typed.
 * @returns The matches, best first.
 */
export function matchProducts(
  products: ProductVM[],
  term: string,
): ProductVM[] {
  const needle = term.trim().toLowerCase();

  if (needle === '') {
    return products.slice(0, 8);
  }

  return products
    .filter((product) =>
      [product.name, product.brand, product.barcode]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle)),
    )
    .slice(0, 8);
}

// --- 3. API CALLS ---

export const productsQueryKey = (retailerId: string) =>
  ['products', retailerId] as const;

/**
 * Lists a retailer's catalogue.
 * @param retailerId The retailer whose products to read.
 * @returns A Promise that resolves with the catalogue.
 */
export const getProducts = async (retailerId: string): Promise<ProductVM[]> => {
  try {
    const response =
      await apiClient.products.productsControllerFindAllByRetailer({
        retailerId,
      });

    return response.data.map(toProductVM);
  } catch (error) {
    throwError(error, 'Could not load your product catalogue.');
  }
};

/**
 * Adds a product to the catalogue.
 * @param input What the product is.
 * @returns A Promise that resolves with the new product.
 */
export const createProduct = async (input: {
  retailerId: string;
  name: string;
  category: ProductCategory;
  brand?: string;
  barcode?: string;
  defaultUnit?: UnitOfMeasure;
  averageUnitWeightKg?: number;
}): Promise<ProductVM> => {
  try {
    const response = await apiClient.products.productsControllerCreate({
      createProductDto: input,
    });

    return toProductVM(response.data);
  } catch (error) {
    throwError(error, 'Could not save that product.');
  }
};
