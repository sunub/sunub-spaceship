export interface IResourceService {
  getItem<T = any>(name: string): T
}