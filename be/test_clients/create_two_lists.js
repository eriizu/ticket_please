#!/usr/bin/env bun

async function generate_example(opens_at, closes_at, name) {
  const listMaster = process.env.DEFAULT_LIST_MASTER;
  if (!listMaster) {
    throw new Error("DEFAULT_LIST_MASTER is not set");
  }
  console.log("body",
    JSON.stringify({
      name,
      opens_at,
      closes_at
    }));
  const response = await fetch(
    `http://localhost:3000/list?master=${encodeURIComponent(listMaster)}`,
    {
      method: "POST",
      body:
        JSON.stringify({
          name,
          opens_at,
          closes_at
        }),
      headers: {
        "Content-type": "application/json; charset=UTF-8",
      },
    },
  );

  if (response.status != 200) {
    console.error(await response.text());
    return;
  }

  const body = await response.json();
  console.log(body);
  await fetch(`http://localhost:3000/list/${body.secret}/slots/gen`, {
    method: "POST",
    body: JSON.stringify({
      "start": opens_at,
      "slot_duration_minutes": 20,
      "break_duration_minutes": 15,
      "break_every_n_slots": 2,
      "slot_number": 3
    }),
    headers: {
      "Content-type": "application/json; charset=UTF-8",
    },
  });
  if (response.status < 200 || response.status >= 300) {
    console.error(await response.text());
    return;
  }
  const failedRegisterResponse = await fetch(
    `http://localhost:3000/list/${body.id}/reg`,
    {
      method: "POST",
      body: JSON.stringify({
        client_name: "Example Registration",
      }),
      headers: {
        "Content-type": "application/json; charset=UTF-8",
      },
    },
  );

  if (failedRegisterResponse.status >= 200 && failedRegisterResponse.status < 300) {
    console.error("weird, the request should not have completed");
    return;
  }

  const registerResponse = await fetch(
    `http://localhost:3000/list/${body.id}/reg?invite_code=${encodeURIComponent(body.invite_code)}`,
    {
      method: "POST",
      body: JSON.stringify({
        client_name: "Example Registration",
      }),
      headers: {
        "Content-type": "application/json; charset=UTF-8",
      },
    },
  );
  if (registerResponse.status < 200 || registerResponse.status >= 300) {
    console.error(await registerResponse.text());
    return;
  }

  const list = await fetch(`http://localhost:3000/list/${body.id}`);
  console.log(await list.json());
}

let opens_at = new Date();
let closes_at = new Date();
closes_at.setTime(closes_at.getTime() + 4 * 60 * 60 * 1000);
generate_example(opens_at, closes_at, "Defense Maze");

opens_at = new Date();
opens_at.setTime(opens_at.getTime() + 4 * 60 * 60 * 1000);
closes_at = new Date();
closes_at.setTime(closes_at.getTime() + 8 * 60 * 60 * 1000);
generate_example(opens_at, closes_at, "FU Runner");
