import { FilterConfig, IFilterConfig } from '../models/filterConfig.model';

const GLOBAL_KEY = 'global';

export class FilterConfigRepository {
  public async get(): Promise<IFilterConfig | null> {
    return FilterConfig.findOne({ key: GLOBAL_KEY }).exec();
  }

  public async upsert(data: {
    hiddenCategories?: string[];
    metals?: string[];
    priceRanges?: { label: string; value: string }[];
  }): Promise<IFilterConfig> {
    return FilterConfig.findOneAndUpdate(
      { key: GLOBAL_KEY },
      {
        $set: {
          hiddenCategories: data.hiddenCategories ?? [],
          metals: data.metals ?? [],
          priceRanges: data.priceRanges ?? [],
        },
      },
      { new: true, upsert: true },
    ).exec() as Promise<IFilterConfig>;
  }
}
