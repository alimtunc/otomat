/** The slice of a TanStack query result the mocked hooks under test actually read. */
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
