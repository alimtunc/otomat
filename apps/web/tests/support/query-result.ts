/** The slice of a query result the mocked `@web/api/daemon/queries` hooks expose; naming it keeps `vi.fn()`'s type out of the inferred surface. */
export interface MockedQueryResult<Data> {
  data: Data;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => void;
}
