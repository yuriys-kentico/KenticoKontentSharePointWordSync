import { IContentItem } from './models/management/IContentItem';

export interface ISyncResponse {
  totalApiCalls: number;
  totalMilliseconds: number;
  newItem: IContentItem;
  language: { id: string };
}
