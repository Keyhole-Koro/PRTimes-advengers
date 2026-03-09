import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type PresenceUser = {
  userId: string;
  name: string;
  color: string;
  selection: {
    from: number;
    to: number;
  };
};

const remotePresencePluginKey = new PluginKey<DecorationSet>("remotePresence");

function withAlpha(hexColor: string, alpha: string) {
  const normalized = hexColor.trim();
  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return `${normalized}${alpha}`;
  }

  return hexColor;
}

function createCursorWidget(user: PresenceUser) {
  return () => {
    const caret = document.createElement("span");
    caret.className = "remoteCaret";
    caret.style.setProperty("--presence-color", user.color);

    const label = document.createElement("span");
    label.className = "remoteCaretLabel";
    label.textContent = user.name;
    label.style.setProperty("--presence-color", user.color);

    caret.append(label);
    return caret;
  };
}

function buildDecorations(doc: Parameters<DecorationSet["map"]>[1], users: PresenceUser[]) {
  const decorations: Decoration[] = [];

  for (const user of users) {
    const from = Math.max(0, Math.min(user.selection.from, doc.content.size));
    const to = Math.max(0, Math.min(user.selection.to, doc.content.size));

    if (from !== to) {
      decorations.push(
        Decoration.inline(Math.min(from, to), Math.max(from, to), {
          class: "remoteSelection",
          style: `--presence-color: ${user.color}; background-color: ${withAlpha(user.color, "22")};`,
        }),
      );
    }

    decorations.push(
      Decoration.widget(to, createCursorWidget(user), {
        side: 1,
        key: `${user.userId}:${to}:${user.selection.from !== user.selection.to ? "range" : "caret"}`,
      }),
    );
  }

  return DecorationSet.create(doc, decorations);
}

export const RemotePresence = Extension.create({
  name: "remotePresence",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: remotePresencePluginKey,
        state: {
          init: (_, state) => DecorationSet.create(state.doc, []),
          apply(transaction, decorations, _oldState, newState) {
            const remoteUsers = transaction.getMeta(remotePresencePluginKey) as
              | PresenceUser[]
              | undefined;

            if (remoteUsers) {
              return buildDecorations(newState.doc, remoteUsers);
            }

            return decorations.map(transaction.mapping, transaction.doc);
          },
        },
        props: {
          decorations(state) {
            return remotePresencePluginKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export function setRemotePresence(editor: Editor, users: PresenceUser[]) {
  editor.view.dispatch(editor.state.tr.setMeta(remotePresencePluginKey, users));
}
