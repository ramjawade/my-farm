/** A sale of produce from a crop. `soldOn` is a local calendar date, `YYYY-MM-DD`. */
export interface CropSale {
  id: number;
  cropId: number;
  soldOn: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  buyer?: string;
  notes?: string;
}

/** What the sale form saves; the crop comes from the route. */
export type CropSaleInput = Omit<CropSale, 'id' | 'cropId'>;

export const SALE_UNIT_SUGGESTIONS = ['crates', 'kg', 'quintal', 'bags', 'tonnes'];
