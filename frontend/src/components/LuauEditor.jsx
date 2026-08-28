import Editor from "@monaco-editor/react";

export default function LuauEditor({ value, height = "100%" }) {
  return (
    <Editor
      height={height}
      language="lua"
      theme="vs-dark"
      value={value}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 12.5,
        fontFamily: "'JetBrains Mono', monospace",
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: "none",
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        wordWrap: "on",
      }}
      onMount={(editor, monaco) => {
        monaco.editor.defineTheme("guiblox", {
          base: "vs-dark",
          inherit: true,
          rules: [
            { token: "keyword", foreground: "C084FC" },
            { token: "string", foreground: "4ADE80" },
            { token: "number", foreground: "F472B6" },
            { token: "comment", foreground: "64748B" },
          ],
          colors: {
            "editor.background": "#0A0A0F",
            "editor.lineHighlightBackground": "#13131F",
            "editorLineNumber.foreground": "#3F3A55",
          },
        });
        monaco.editor.setTheme("guiblox");
      }}
    />
  );
}
