import { TrashIcon } from "@moonlight-mod/wp/discord/components/common/index";
import React from "@moonlight-mod/wp/react";
import spacepack from "@moonlight-mod/wp/spacepack_spacepack";

const TimestampTooltip = spacepack.require("discord/modules/messages/web/TimestampTooltip").default;
const MessageActionCreators = spacepack.require("discord/actions/MessageActionCreators").default;

const { Anchor } = spacepack.findByCode("{Anchor:()=>")[0].exports;
const EphemeralClasses = spacepack.findByCode('"ephemeralMessage_')[0].exports;
const ephemeralMessage = spacepack.findObjectFromValueSubstring(EphemeralClasses, "ephemeralMessage");
const iconClass = spacepack.findObjectFromValueSubstring(EphemeralClasses, "icon");

export default function AntiDeleteFooter({ message }: { message: any }) {
  return (
    <div className={`${ephemeralMessage} antiDelete-footer`} onClick={(event) => event.stopPropagation()}>
      <TrashIcon size="xs" color="currentcolor" className={iconClass} />
      {"Deleted at "}
      <TimestampTooltip timestamp={message.deleted_timestamp} />
      {" \u2022 "}
      <Anchor
        onClick={() => {
          MessageActionCreators.dismissAutomatedMessage(message);
        }}
      >
        Fully delete
      </Anchor>
    </div>
  );
}
