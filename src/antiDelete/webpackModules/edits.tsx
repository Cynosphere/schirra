import React from "@moonlight-mod/wp/react";
import spacepack from "@moonlight-mod/wp/spacepack_spacepack";

const TimestampTooltip = spacepack.require("discord/modules/messages/web/TimestampTooltip").default;
const MarkupUtils = spacepack.require("discord/modules/markup/MarkupUtils").default;
const { isMessageNewerThanImprovedMarkdownEpoch } = spacepack.require("discord/modules/markup/MarkupEligibilityUtils");

const MarkupClasses = spacepack.require("discord/modules/messages/web/Markup.css");
const MessageClasses = spacepack.require("discord/modules/messages/web/Message.css");

export default function AntiDeleteEdits({ message }: { message: any }) {
  const useExtendedMarkdown = isMessageNewerThanImprovedMarkdownEpoch(message.id);
  const edits = message.edits ?? [];

  return edits.map((edit: { content: string; timestamp: Date; original: boolean }) => (
    <div className={`${MarkupClasses.markup} ${MessageClasses.messageContent} antiDelete-edit`}>
      {MarkupUtils.parse(edit.content, true, {
        // @ts-expect-error untyped
        channelId: message.channel_id,
        viewedChannelId: message.channel_id,
        allowList: useExtendedMarkdown,
        allowHeading: useExtendedMarkdown,
        allowLinks: useExtendedMarkdown,
        previewLinkTarget: useExtendedMarkdown
      })}{" "}
      <TimestampTooltip timestamp={edit.timestamp} isEdited={!edit.original} isInline={false}>
        <span className={MessageClasses.edited}>{edit.original ? "(original)" : "(past edit)"}</span>
      </TimestampTooltip>
    </div>
  ));
}
