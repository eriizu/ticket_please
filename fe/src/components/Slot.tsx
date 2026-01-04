import type * as models from "../models";
import type {Registration} from "./RegisterModal";

export function SlotBase(props: { children: React.ReactNode }) {
  return (
    <div className="border h-12 rounded-md p-1 flex items-center gap-3">
      {props.children}
    </div>
  );
}

const absoluteTimeFormater = Intl.DateTimeFormat("en-IE", {
  timeStyle: "short",
});

export function SlotOpen2({
  slot,
  setRegisteringFor: setRegistration,
  registered_somewhere_else,
}: {
  slot: typeof models.SlotBase.infer;
  setRegisteringFor?: (reg: Registration) => void;
  registered_somewhere_else: boolean;
}) {
  return (
    <SlotBase>
      <div className="w-20 flex-none">
        <div className="tabular-nums text-xl">
          {absoluteTimeFormater.format(slot.starts_at)}
        </div>
        {registered_somewhere_else ? (
          slot.starts_at > new Date() ? (
            <div className="text-neutral-600 text-xs font-mono">AVAILABLE</div>
          ) : (
            <div className="text-neutral-600 text-xs font-mono">PAST</div>
          )
        ) : slot.starts_at > new Date() ? (
          <div className="text-green-800 text-xs font-mono">AVAILABLE</div>
        ) : (
          <div className="text-red-800 text-xs font-mono">PAST</div>
        )}
      </div>
      <div className="flex place-content-end w-full">
        {!registered_somewhere_else &&
          setRegistration &&
          slot.starts_at > new Date() ? (
          <button
            type="button"
            className='btn-secondary before:content-["+"] before:mr-1'
            onClick={(_) => {
              setRegistration({ slot_id: slot.id, list_id: slot.list_id });
            }}
          >
            register
          </button>
        ) : null}
      </div>
    </SlotBase>
  );
}

export function SlotTaken1({ slot }: { slot: typeof models.SlotBase.infer }) {
  return (
    <div className="text-neutral-700">
      <SlotBase>
        <div className="flex-none">
          <div className="tabular-nums text-xl">
            {absoluteTimeFormater.format(slot.starts_at)}
          </div>
          <div className="text-red-800 text-xs font-mono w-fit">NOT AVAIL.</div>
        </div>
        <div className="align-bottom">
          {/* <div className="text-red-800">:: not avail. ::</div>*/}
          <div className="whitespace-nowrap overflow-hidden text-ellipsis text-xs">
            {slot.registered_client_name}
          </div>
          <div className="text-xs">is currently registered</div>
        </div>
      </SlotBase>
    </div>
  );
}

export function SlotMine({ slot }: { slot: typeof models.SlotBase.infer }) {
  return (
    <SlotBase>
      <div className="flex-none">
        <div className="tabular-nums text-xl">
          {absoluteTimeFormater.format(slot.starts_at)}
        </div>
        <div className="text-green-800 text-xs font-mono w-fit">
          YOURS
        </div>
      </div>
      <div className="align-bottom">
        {/* <div className="text-red-800">:: not avail. ::</div>*/}
        <div className="whitespace-nowrap overflow-hidden text-ellipsis text-xs">
          {slot.registered_client_name}
        </div>
        <div className="text-xs font-semibold">this is your slot</div>
      </div>
    </SlotBase>
  );
}

