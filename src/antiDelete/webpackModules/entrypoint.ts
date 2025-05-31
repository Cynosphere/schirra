import spacepack from "@moonlight-mod/wp/spacepack_spacepack";

import Dispatcher from "@moonlight-mod/wp/discord/Dispatcher";
import { AuthenticationStore } from "@moonlight-mod/wp/common_stores";
import { MessageFlags } from "@moonlight-mod/wp/discord/Constants";

const ChannelMessages = spacepack.require("discord/lib/ChannelMessages").default;
const tinycolor = spacepack.require("ctrl/tinycolor");

const logger = moonlight.getLogger("Anti-Delete");

function jsonifyMessage(message: any) {
  const edits = message.edits;
  const editedTimestamp = message.editedTimestamp ?? message.edited_timestamp;

  const messageJson = JSON.parse(JSON.stringify(message));

  messageJson.edits = edits;
  messageJson.editedTimestamp = editedTimestamp;
  messageJson.edited_timestamp = messageJson.editedTimestamp;

  messageJson.message_reference = messageJson.messageReference;
  messageJson.message_snapshots = messageJson.messageSnapshots;

  if (messageJson.embeds?.length > 0) {
    let elem;
    if (document?.body) {
      elem = document.createElement("div");
      document.body.appendChild(elem);
    }

    for (const embed of messageJson.embeds) {
      if (elem && embed.color) {
        elem.style.color = embed.color;
        embed.color = parseInt(`0x${tinycolor(window.getComputedStyle(elem).color).toHex()}`);
      }

      embed.description = embed.rawDescription;
      embed.title = embed.rawTitle;

      if (embed.author) {
        embed.author.icon_url = embed.author.iconURL;
        embed.author.proxy_icon_url = embed.author.iconProxyURL;
      }

      if (embed.footer) {
        embed.footer.icon_url = embed.footer.iconURL;
        embed.footer.proxy_icon_url = embed.footer.iconProxyURL;
      }

      if (embed.image) {
        embed.image.proxy_url = embed.image.proxyURL;
      }
      if (embed.thumbnail) {
        embed.thumbnail.proxy_url = embed.thumbnail.proxyURL;
      }
      if (embed.video) {
        embed.video.proxy_url = embed.video.proxyURL;
      }

      if (embed.fields?.length > 0) {
        for (const field of embed.fields) {
          field.name = field.rawName;
          field.value = field.rawValue;
        }
      }

      if (embed.images?.length > 0 && !embed._antiDelete_unfurl) {
        for (const index in embed.images) {
          if (index === "0") continue;

          messageJson.embeds.push({ ...embed, image: embed.images[index], _antiDelete_unfurl: true });
        }
      }
    }

    if (elem) document.body.removeChild(elem);
  }

  return messageJson;
}

Dispatcher.addInterceptor((event) => {
  try {
    const deleteEnabled = moonlight.getConfigOption<boolean>("antiDelete", "deletes") ?? true;
    const editEnabled = moonlight.getConfigOption<boolean>("antiDelete", "edits") ?? true;

    const ignoreSelf = moonlight.getConfigOption<boolean>("antiDelete", "ignoreSelf") ?? false;
    const ignoreBots = moonlight.getConfigOption<boolean>("antiDelete", "ignoreBots") ?? false;

    const ignoredUsers = moonlight.getConfigOption<string[]>("antiDelete", "ignoredUsers") ?? [];
    const ignoredChannels = moonlight.getConfigOption<string[]>("antiDelete", "ignoredChannels") ?? [];

    const ignorePluralKit = moonlight.getConfigOption<boolean>("antiDelete", "ignorePluralKit") ?? false;
    const ignorePluralKitPrefix = moonlight.getConfigOption<boolean>("antiDelete", "ignorePluralKitPrefix") ?? true;

    const selfId = AuthenticationStore.getId();

    if (event.type === "MESSAGE_DELETE" && deleteEnabled) {
      if (event._antiDelete_force) return false;

      if (ignoredChannels.includes(event.channelId)) return false;

      const messages = ChannelMessages._channelMessages[event.channelId];
      if (!messages) return false;
      const message = messages.get(event.id);
      if (!message?.author) return false;

      if (ignoredUsers.includes(message.author.id)) return false;
      if (ignoreSelf && message.author.id === selfId) return false;
      if (ignoreBots && message.author.bot) return false;

      if (message.state === "SEND_FAILED") return false;

      if (message.flags & MessageFlags.EPHEMERAL) return false;

      if (ignorePluralKit) {
        fetch("https://api.pluralkit.me/v2/messages/" + encodeURIComponent(event.id))
          .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
          .then((data) => {
            if (data.original === event.id && !data.member?.keep_proxy) {
              Dispatcher.dispatch({
                type: "MESSAGE_DELETE",
                channelId: event.channelId,
                id: event.id,
                _antiDelete_force: true
              });
            }
          })
          .catch(() => {});
      } else if (ignorePluralKitPrefix) {
        const possiblePluralKitMessages = messages
          .getManyAfter(event.id, 5)
          .filter((message: any) => message.webhookId != null && message.content != null);

        const MAX_TRIM = 20;
        const triggerContent = message.content;
        const lengthMin = triggerContent.length - MAX_TRIM;
        for (const botMessage of possiblePluralKitMessages) {
          if (botMessage.content.length > lengthMin && triggerContent.includes(botMessage.content)) {
            return false;
          }
        }
      }

      message.deleted = true;
      message.deleted_timestamp = new Date();

      Dispatcher.dispatch({
        type: "MESSAGE_UPDATE",
        message: jsonifyMessage(message)
      });

      return true;
    } else if (event.type === "MESSAGE_UPDATE" && editEnabled) {
      const channelId = event.message.channel_id;
      if (ignoredChannels.includes(channelId)) return false;
      if (ignoredUsers.includes(event.message.author.id)) return false;
      if (ignoreSelf && event.message.author.id === selfId) return false;
      if (ignoreBots && event.message.author.bot) return false;

      const messages = ChannelMessages._channelMessages[channelId];
      if (!messages) return false;
      const oldMessage = messages.get(event.message.id);
      if (!oldMessage) return false;

      // TODO: embed diffing as small text, maybe also SUPPRESS_EMBEDS and other flags idk
      if (oldMessage.content === event.message.content) return false;

      event.message.edits = oldMessage.edits ?? [];
      event.message.edits.push({
        content: oldMessage.content,
        timestamp: oldMessage.editedTimestamp ?? oldMessage.timestamp,
        original: oldMessage.editedTimestamp == null
      });
    }

    return false;
  } catch (err) {
    logger.error("Failed to process event:", err);
    return false;
  }
});
