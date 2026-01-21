#!/usr/bin/env bun

async function main() {
  const parentSecret = process.env.DEFAULT_LIST_MASTER;
  if (!parentSecret) {
    throw new Error("DEFAULT_LIST_MASTER is not set");
  }

  const listMasterResponse = await fetch(
    `http://localhost:3000/list_master/${encodeURIComponent(parentSecret)}/child`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "Test List Master",
      }),
      headers: {
        "Content-type": "application/json; charset=UTF-8",
      },
    },
  );

  if (listMasterResponse.status !== 200) {
    throw new Error(await listMasterResponse.text());
  }

  const listMaster = await listMasterResponse.json();
  const listResponse = await fetch(
    `http://localhost:3000/list?master=${encodeURIComponent(listMaster.secret)}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "Test List",
        opens_at: null,
        closes_at: null,
      }),
      headers: {
        "Content-type": "application/json; charset=UTF-8",
      },
    },
  );

  if (listResponse.status !== 200) {
    throw new Error(await listResponse.text());
  }

  const deleteResponse = await fetch(
    `http://localhost:3000/list_master/${encodeURIComponent(parentSecret)}/child/${listMaster.id}`,
    {
      method: "DELETE",
    },
  );

  if (deleteResponse.status !== 204) {
    throw new Error(await deleteResponse.text());
  }

  console.log("Created list master:", listMaster);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
