import { ExtensionWebpackModule, Patch } from "@moonlight-mod/types";

export const patches: Patch[] = [
  // Message record
  {
    find: '.set("roleSubscriptionData",',
    replace: [
      // Allow deleted to create records
      {
        match: /if\(null!=(\i)\.edited_timestamp\)/,
        replacement: (_, message) => `if(${message}.deleted||null!=${message}.edited_timestamp)`
      },

      // Edits make updates
      {
        match: /\i\.pinned!==\i\.pinned&&\(\i=\i\.set\("pinned",\i\.pinned\)\),/,
        replacement: (orig: string) =>
          `${orig}${orig.replaceAll("pinned", "edits")}${orig.replaceAll("pinned", "deleted_timestamp")}`
      },

      // Make fields known to message constructor
      {
        match: /mentionEveryone:(\i)\.mention_everyone,/,
        replacement: (orig, message) =>
          `deleted:${message}.deleted,deleted_timestamp:${message}.deleted_timestamp,edits:${message}.edits,${orig}`
      }
    ]
  },

  // Add fields to Message class
  {
    find: "}isFirstMessageInForumPost(",
    replace: {
      match: /this\.customRenderedContent=(\i)\.customRenderedContent,/,
      replacement: (orig, message) =>
        `${orig}this.deleted=!!${message}.deleted,this.deleted_timestamp=${message}.deleted_timestamp,this.edits=${message}.edits,`
    }
  },

  // Add deleted class to MessageListItem
  {
    find: '"Message must not be a thread starter message"',
    replace: {
      match: /\[\i\.mentioned\]:(\i)\.mentioned,/g,
      replacement: (orig, message) => `${orig}"antiDelete-deleted":${message}.deleted,`
    }
  },

  // Disallow deleted from canEdit
  {
    find: /\|\|(\i)\.hasFlag\(\i\.\i\.IS_VOICE_MESSAGE\)/,
    replace: {
      match: /\|\|(\i)\.hasFlag\(\i\.\i\.IS_VOICE_MESSAGE\)/,
      replacement: (orig, message) => `${orig}||${message}.deleted`
    }
  },

  // Give minimal message actions/context menu for deleted
  {
    find: "MESSAGE_POPOUT_MENU_OPENED_DESKTOP,{",
    replace: [
      {
        match: /(\i)\.state===\i\.\i\.SEND_FAILED/,
        replacement: (orig, message) => `${orig}||${message}.deleted`
      },
      {
        match: /(\i)\.state!==\i\.\i\.SEND_FAILED/,
        replacement: (orig, message) => `${orig}&&!${message}.deleted`
      },
      {
        match: /(?<=\((\i)\.interactionData\);return.+?)children:\[!/,
        replacement: (_, message) => `children:[!${message}.deleted&&!`
      }
    ]
  },
  {
    find: ',source:"message-actions"})',
    replace: {
      match: /(\i)\.state===\i\.\i\.SEND_FAILED\|\|(.+?)\.id,(\i\.state===\i\.\i\.SEND_FAILED)\)/,
      replacement: (_, message, body, failed) =>
        `${failed}||${message}.deleted||${body}.id,${failed}||${message}.deleted,${message}.deleted)`
    }
  },
  {
    find: "discord/actions/MessageActionCreators",
    replace: [
      {
        match: 'type:"MESSAGE_DELETE",id:',
        replacement: 'type:"MESSAGE_DELETE",_antiDelete_force:arguments[3],id:'
      },
      {
        match: /(?<=dismissAutomatedMessage\((\i)\){.+?this\.deleteMessage\(\i\.channel_id,\i\.id,)!0\)},/,
        replacement: (_, message) => `!0,${message}.deleted)},`
      }
    ]
  },
  {
    find: '("referencedUsernameProfile",',
    replace: {
      match: /,(\i)=\i\.\i\.getMessage.+?isEditing\(\i,\i\);/,
      replacement: (orig, message) => `${orig}if(${message}.deleted)return;`
    }
  },

  {
    find: '.provider&&"Discord"===',
    replace: [
      // Footer
      {
        match: /renderEphemeralAccessories\((\i)\){return(?=.+?\)\?(\(0,(\i)\.jsx\)))/,
        replacement: (orig, message, createElement, ReactJSX) =>
          `${orig} ${message}.deleted?${createElement}(require("antiDelete_footer")?.default??${ReactJSX}.Fragment,{message:${message}}):`
      },

      // Force obscure deleted embeds/attachments
      {
        match: /embed:\i,obscureReason:/,
        replacement: (orig: string) => `${orig}this.props.message.deleted?"antidelete":`
      },
      {
        match: "{shouldRedactExplicitContent:",
        replacement: (orig: string) => `${orig}arguments[0].deleted?true:`
      }
    ]
  },

  // Edits
  {
    find: ".isFailed]:",
    replace: [
      {
        match: /\["message"]\)&&(\i)\.content===(\i)\.content/,
        replacement: (_, newMessage, oldMessage) =>
          `["message"])&&${newMessage}.edits===${oldMessage}.edits&&${newMessage}.content===${oldMessage}.content`
      },
      {
        match: /(\(0,(\i)\.jsxs\))\("div",{id:\(0,\i\.\i\)\((\i)\),ref:.+?\.WITH_CONTENT}\)]}\)/,
        replacement: (orig, createElement, ReactJSX, message) =>
          `[!(arguments[0].className!=null&&arguments[0].className.indexOf("repliedTextContent")>-1)&&${message}.edits?.length>0&&${createElement}(require("antiDelete_edits")?.default??${ReactJSX}.Fragment,{message:${message}}),${orig}]`
      }
    ]
  },

  // Attachments need a bit of extra effort to force obscure
  {
    find: ".mosaicItemContent,{",
    replace: [
      {
        match: /,(\i)=(\i\(\i,\(0,\i\.\i\)\((\i)\)\)),(\[(\i),(\i)]=\i\.useState\(null!=\i\)),/,
        replacement: (_, obscureReason, orig, message, state, obscured, setObscured) =>
          `,_obscureReason=${orig},${obscureReason}=${message}.deleted?"antidelete":_obscureReason,${state};if(${message}.deleted&&${obscured}===false)${setObscured}(true);let `
      }
    ]
  },

  // Use custom obscure type to bypass geographic age verification
  {
    find: "renderObscuredAttachment(){",
    replace: [
      {
        match: /,\i(?=\?null:\(0,\i\.jsx\)\(\i,{obscureReason:(\i),)/g,
        replacement: (orig, obscureReason) => `${orig}&&${obscureReason}!=="antidelete"`
      },
      {
        match: /case \i\.\i\.POTENTIAL_EXPLICIT_CONTENT:/g,
        replacement: (orig: string) => `${orig}case "antidelete":`
      },
      {
        match: /return (\i)!==(\i\.\i\.EXPLICIT_CONTENT)&&/,
        replacement: (_, reason, explicit) => `return ${reason}!==${explicit}&&${reason}!=="antidelete"&&`
      }
    ]
  },
  {
    find: 'new Set(["explicit_content","gore_content","potential_explicit_content"])',
    replace: {
      match: ',"potential_explicit_content"',
      replacement: ',"potential_explicit_content","antidelete"'
    }
  }
];

export const webpackModules: Record<string, ExtensionWebpackModule> = {
  entrypoint: {
    dependencies: [
      { id: "react" },
      { id: "discord/Dispatcher" },
      { id: "discord/Constants" },
      { id: "discord/lib/ChannelMessages" },
      { id: "ctrl/tinycolor" },
      { ext: "common", id: "stores" },
      { ext: "spacepack", id: "spacepack" }
    ],
    entrypoint: true
  },
  footer: {
    dependencies: [
      { id: "react" },
      { ext: "spacepack", id: "spacepack" },
      { id: "discord/modules/messages/web/TimestampTooltip" },
      { id: "discord/components/common/index" },
      { id: "discord/actions/MessageActionCreators" }
    ]
  },
  edits: {
    dependencies: [
      { id: "react" },
      { ext: "spacepack", id: "spacepack" },
      { id: "discord/modules/messages/web/TimestampTooltip" },
      { id: "discord/modules/markup/MarkupUtils" },
      { id: "discord/modules/markup/MarkupEligibilityUtils" },
      { id: "discord/modules/messages/web/Markup.css" },
      { id: "discord/modules/messages/web/Message.css" }
    ]
  }
};
