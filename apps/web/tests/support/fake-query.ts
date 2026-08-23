export interface FakeQueryState {
  data?: unknown;
  error?: unknown;
  isPending?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  isFetching?: boolean;
  isLoading?: boolean;
  dataUpdatedAt?: number;
  refetch?: () => void;
}
