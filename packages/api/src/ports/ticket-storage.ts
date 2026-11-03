export type TicketBlobStorage = {
  put: (
    pathname: string,
    file: File,
    options: {
      access: "private";
      contentType: string;
      addRandomSuffix: false;
    },
  ) => Promise<unknown>;
  get: (
    pathname: string,
    options: { access: "private" },
  ) => Promise<{
    statusCode: number;
    stream: ReadableStream<Uint8Array> | null;
  } | null>;
  del: (pathname: string) => Promise<void>;
};
