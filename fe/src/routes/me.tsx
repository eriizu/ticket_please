import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type } from "arktype";
import { useEffect, useRef, useState } from "react";
import { usePersistent } from "@/hooks/usePersistent";
import * as models from "../models";

// Search params schema
interface MeSearchParams {
  reg_master?: string;
  reg_token?: string;
  reg_list?: string;
}

export const Route = createFileRoute("/me")({
  validateSearch: (search: Record<string, unknown>): MeSearchParams => ({
    reg_master:
      typeof search.reg_master === "string" ? search.reg_master : undefined,
    reg_token:
      typeof search.reg_token === "string" ? search.reg_token : undefined,
    reg_list: typeof search.reg_list === "string" ? search.reg_list : undefined,
  }),
  component: MePage,
});

// Schema for token validation response
const TokenValidationResponse = type({
  id: "number",
  list_id: "number",
  slot_id: "number | null",
  secret: "string",
  list: models.WaitingListBase,
  "slot?": models.SlotBase.or("null"),
});

// Schema for list validation response
const ListValidationResponse = models.WaitingListRelated;

interface ImportResult {
  id: string;
  type: "master" | "token" | "list";
  success: boolean;
  message: string;
}

async function validateToken(secret: string) {
  const res = await fetch(`/api/token/${secret}`);
  if (res.status === 404) {
    throw new Error("Token not found or invalid");
  }
  if (!res.ok) {
    throw new Error(`Failed to validate token: ${res.statusText}`);
  }
  const data = await res.json();
  const parsed = TokenValidationResponse(data);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid token response: ${parsed.toString()}`);
  }
  return parsed;
}

async function validateList(secret: string) {
  const res = await fetch(`/api/list/${secret}`);
  if (res.status === 404) {
    throw new Error("List not found or invalid secret");
  }
  if (!res.ok) {
    throw new Error(`Failed to validate list: ${res.statusText}`);
  }
  const data = await res.json();
  const parsed = ListValidationResponse(data);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid list response: ${parsed.toString()}`);
  }
  return parsed;
}

function MePage() {
  const [storage, setStorage] = usePersistent();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const hasProcessedImports = useRef(false);

  // Process imports from URL params on mount
  useEffect(() => {
    // Only process once
    if (hasProcessedImports.current) return;

    const hasImports = search.reg_master || search.reg_token || search.reg_list;
    if (!hasImports) return;

    hasProcessedImports.current = true;

    const processImports = async () => {
      setIsImporting(true);
      const results: ImportResult[] = [];

      // Import master secret (no validation, just store)
      if (search.reg_master) {
        storage.list_master = search.reg_master;
        results.push({
          id: "master",
          type: "master",
          success: true,
          message: "List master secret imported",
        });
      }

      // Import token (with validation)
      if (search.reg_token) {
        try {
          const token = await validateToken(search.reg_token);
          // Check if token already exists
          const exists = storage.known_tokens.some((t) => t.id === token.id);
          if (!exists) {
            storage.known_tokens.push({
              id: token.id,
              list_id: token.list_id,
              slot_id: token.slot_id,
              secret: token.secret,
            });
            results.push({
              id: `token-${token.id}`,
              type: "token",
              success: true,
              message: `Token #${token.id} imported for list "${token.list.name}"`,
            });
          } else {
            results.push({
              id: `token-${token.id}-exists`,
              type: "token",
              success: true,
              message: `Token #${token.id} already exists`,
            });
          }
        } catch (e) {
          results.push({
            id: "token-error",
            type: "token",
            success: false,
            message: e instanceof Error ? e.message : "Failed to import token",
          });
        }
      }

      // Import list (with validation)
      if (search.reg_list) {
        try {
          const list = await validateList(search.reg_list);
          // Check if list already exists
          const exists = storage.known_lists[list.id] !== undefined;
          if (!exists) {
            storage.known_lists[list.id] = search.reg_list;
            results.push({
              id: `list-${list.id}`,
              type: "list",
              success: true,
              message: `List "${list.name}" imported`,
            });
          } else {
            results.push({
              id: `list-${list.id}-exists`,
              type: "list",
              success: true,
              message: `List "${list.name}" already exists`,
            });
          }
        } catch (e) {
          results.push({
            id: "list-error",
            type: "list",
            success: false,
            message: e instanceof Error ? e.message : "Failed to import list",
          });
        }
      }

      // Save storage and update results
      setStorage(storage);
      setImportResults(results);
      setIsImporting(false);

      // Clean URL by removing query params
      navigate({ to: "/me", search: {}, replace: true });
    };

    processImports();
  }, [search, storage, setStorage, navigate]);

  const handleClearMaster = () => {
    storage.list_master = null;
    setStorage(storage);
  };

  const handleRemoveToken = (tokenId: number) => {
    storage.known_tokens = storage.known_tokens.filter((t) => t.id !== tokenId);
    setStorage(storage);
  };

  const handleRemoveList = (listId: number) => {
    delete storage.known_lists[listId];
    setStorage(storage);
  };

  return (
    <div className="text-neutral-800">
      <h1 className="text-2xl font-bold mb-4">My Profile</h1>

      {/* Import Results */}
      {importResults.length > 0 && (
        <div className="mb-4 p-3 border rounded-lg border-neutral-400 bg-neutral-50">
          <h2 className="font-semibold mb-2">Import Results</h2>
          <ul className="space-y-1">
            {importResults.map((result) => (
              <li
                key={result.id}
                className={result.success ? "text-green-700" : "text-red-700"}
              >
                {result.success ? "[ok]" : "[error]"} {result.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isImporting && (
        <div className="mb-4 p-3 border rounded-lg border-amber-400 bg-amber-50">
          Importing secrets...
        </div>
      )}

      {/* List Master Section */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">List Master</h2>
        <div className="p-3 border rounded-lg border-neutral-300">
          {storage.list_master ? (
            <div className="flex items-center gap-2">
              <span className="text-green-700">Configured</span>
              <span className="text-neutral-500 text-sm font-mono">
                ({storage.list_master.slice(0, 8)}...)
              </span>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={handleClearMaster}
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="text-neutral-500">
              Not configured. Import via URL: /me?reg_master=SECRET
            </span>
          )}
        </div>
      </section>

      {/* Known Lists Section */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">
          Known Lists ({Object.keys(storage.known_lists).length})
        </h2>
        <div className="p-3 border rounded-lg border-neutral-300">
          {Object.keys(storage.known_lists).length === 0 ? (
            <span className="text-neutral-500">
              No known lists. Import via URL: /me?reg_list=SECRET
            </span>
          ) : (
            <ul className="space-y-2">
              {Object.entries(storage.known_lists).map(([listId, secret]) => (
                <li
                  key={listId}
                  className="flex items-center gap-2 p-2 bg-neutral-50 rounded"
                >
                  <span>List #{listId}</span>
                  <span className="text-neutral-500 text-sm font-mono">
                    ({secret.slice(0, 8)}...)
                  </span>
                  <button
                    type="button"
                    className="btn-secondary text-sm ml-auto"
                    onClick={() => handleRemoveList(Number(listId))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Known Tokens Section */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">
          Known Tokens ({storage.known_tokens.length})
        </h2>
        <div className="p-3 border rounded-lg border-neutral-300">
          {storage.known_tokens.length === 0 ? (
            <span className="text-neutral-500">
              No known tokens. Import via URL: /me?reg_token=SECRET
            </span>
          ) : (
            <ul className="space-y-2">
              {storage.known_tokens.map((token) => (
                <li
                  key={token.id}
                  className="flex items-center gap-2 p-2 bg-neutral-50 rounded"
                >
                  <span>Token #{token.id}</span>
                  <span className="text-neutral-500 text-sm">
                    (List #{token.list_id}
                    {token.slot_id && `, Slot #${token.slot_id}`})
                  </span>
                  <span className="text-neutral-500 text-sm font-mono">
                    ({token.secret.slice(0, 8)}...)
                  </span>
                  <button
                    type="button"
                    className="btn-secondary text-sm ml-auto"
                    onClick={() => handleRemoveToken(token.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Import Instructions */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Import Secrets</h2>
        <div className="p-3 border rounded-lg border-neutral-300 text-sm">
          <p className="mb-2">
            You can import secrets by visiting URLs with query parameters:
          </p>
          <ul className="list-disc list-inside space-y-1 text-neutral-600">
            <li>
              <code className="bg-neutral-100 px-1 rounded">
                /me?reg_master=SECRET
              </code>{" "}
              - Import list master secret
            </li>
            <li>
              <code className="bg-neutral-100 px-1 rounded">
                /me?reg_token=SECRET
              </code>{" "}
              - Import waiting token
            </li>
            <li>
              <code className="bg-neutral-100 px-1 rounded">
                /me?reg_list=SECRET
              </code>{" "}
              - Import list admin secret
            </li>
          </ul>
          <p className="mt-2 text-neutral-500">
            Multiple parameters can be combined in a single URL.
          </p>
        </div>
      </section>
    </div>
  );
}
