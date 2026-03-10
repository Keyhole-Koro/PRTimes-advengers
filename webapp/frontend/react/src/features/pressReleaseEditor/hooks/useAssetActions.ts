import type { Editor } from "@tiptap/react";
import type { ChangeEvent, DragEvent, RefObject } from "react";
import { useRef, useState } from "react";

import { BASE_URL } from "../constants";
import type { FileWithRelativePath, LinkPreviewResponse, SaveStatus } from "../types";

function isImageFile(file: FileWithRelativePath): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
}

function normalizePathKey(path: string): string {
  return decodeURIComponent(path)
    .trim()
    .split("?")[0]
    .split("#")[0]
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .toLowerCase();
}

type UseAssetActionsOptions = {
  editor: Editor | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  htmlInputRef: RefObject<HTMLInputElement | null>;
  requestFlush: () => void;
  setSaveStatus: (status: SaveStatus) => void;
  setTitle: (title: string) => void;
  title: string;
};

export function useAssetActions({
  editor,
  fileInputRef,
  htmlInputRef,
  requestFlush,
  setSaveStatus,
  setTitle,
  title,
}: UseAssetActionsOptions) {
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isFetchingLinkPreview, setIsFetchingLinkPreview] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragDepthRef = useRef(0);

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${BASE_URL}/uploads/images`, {
      body: formData,
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("画像のアップロードに失敗しました");
    }

    return (await response.json()) as { url: string };
  };

  const fetchLinkPreview = async (url: string) => {
    const response = await fetch(`${BASE_URL}/link-previews?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error("リンク先のOGP情報を取得できませんでした");
    }

    return (await response.json()) as LinkPreviewResponse;
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handlePickHtml = () => {
    htmlInputRef.current?.click();
  };

  const flushAfterImageChange = () => {
    window.setTimeout(() => {
      requestFlush();
    }, 0);
  };

  const handleInsertImage = async () => {
    if (!editor) {
      return;
    }

    const trimmedUrl = imageUrl.trim();
    if (!trimmedUrl) {
      alert("画像URLを入力してください");
      return;
    }

    editor.chain().focus().setImage({ alt: "挿入画像", src: trimmedUrl }).run();
    setImageUrl("");
    flushAfterImageChange();
  };

  const handleInsertLinkCard = async () => {
    if (!editor) {
      return;
    }

    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) {
      alert("URLを入力してください");
      return;
    }

    setIsFetchingLinkPreview(true);

    try {
      const preview = await fetchLinkPreview(trimmedUrl);
      editor
        .chain()
        .focus()
        .insertContent({
          attrs: preview,
          type: "linkCard",
        })
        .run();
      setLinkUrl("");
      flushAfterImageChange();
    } catch (previewError) {
      const message = previewError instanceof Error ? previewError.message : "リンクカードを追加できませんでした";
      alert(message);
    } finally {
      setIsFetchingLinkPreview(false);
    }
  };

  const insertUploadedImage = async (file: File) => {
    if (!editor) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選択してください");
      return;
    }

    setIsUploadingImage(true);

    try {
      const { url } = await uploadImage(file);
      editor.chain().focus().setImage({ alt: file.name || "アップロード画像", src: url }).run();
      flushAfterImageChange();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "画像アップロードに失敗しました";
      alert(message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await insertUploadedImage(file);
    }

    event.target.value = "";
  };

  const buildFileFromDataUrl = async (dataUrl: string, fallbackName: string) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const ext = blob.type.split("/")[1] || "png";
    return new File([blob], `${fallbackName}.${ext}`, { type: blob.type || "image/png" });
  };

  const handleImportHtml = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []) as FileWithRelativePath[];
    if (selectedFiles.length === 0 || !editor) {
      return;
    }

    try {
      const htmlFile = selectedFiles.find(
        (file) => file.type === "text/html" || file.name.toLowerCase().endsWith(".html"),
      );
      if (!htmlFile) {
        alert("HTMLファイルを選択してください");
        return;
      }

      const imageFileMap = new Map<string, File>();
      const selectedImageFiles: File[] = [];
      for (const file of selectedFiles) {
        if (!isImageFile(file)) {
          continue;
        }
        selectedImageFiles.push(file);
        imageFileMap.set(normalizePathKey(file.name), file);
        if (file.webkitRelativePath) {
          imageFileMap.set(normalizePathKey(file.webkitRelativePath), file);
        }
      }

      const htmlText = await htmlFile.text();
      const doc = new DOMParser().parseFromString(htmlText, "text/html");
      const skippedImageSrcList: string[] = [];
      const usedImageNames = new Set<string>();
      const images = Array.from(doc.querySelectorAll("img"));

      for (const [index, img] of images.entries()) {
        const src = img.getAttribute("src")?.trim();
        if (!src) {
          continue;
        }

        try {
          let uploadedUrl = "";

          if (src.startsWith("data:")) {
            const dataFile = await buildFileFromDataUrl(src, `imported-image-${index + 1}`);
            const uploaded = await uploadImage(dataFile);
            uploadedUrl = uploaded.url;
          } else if (/^https?:\/\//i.test(src)) {
            const fetchedImage = await fetch(src);
            if (!fetchedImage.ok) {
              throw new Error("画像の取得に失敗しました");
            }
            const blob = await fetchedImage.blob();
            const ext = blob.type.split("/")[1] || "png";
            const httpFile = new File([blob], `imported-image-${index + 1}.${ext}`, {
              type: blob.type || "image/png",
            });
            const uploaded = await uploadImage(httpFile);
            uploadedUrl = uploaded.url;
          } else {
            const normalizedSrc = normalizePathKey(src);
            const srcName = normalizedSrc.split("/").pop() ?? normalizedSrc;
            let localImageFile = imageFileMap.get(normalizedSrc) ?? imageFileMap.get(srcName);

            if (!localImageFile) {
              localImageFile = selectedImageFiles.find((file) => !usedImageNames.has(file.name));
            }

            if (!localImageFile) {
              skippedImageSrcList.push(src);
              continue;
            }

            usedImageNames.add(localImageFile.name);
            const uploaded = await uploadImage(localImageFile);
            uploadedUrl = uploaded.url;
          }

          img.setAttribute("src", uploadedUrl);
        } catch {
          skippedImageSrcList.push(src);
        }
      }

      const importedTitle =
        doc.querySelector("title")?.textContent?.trim() || doc.querySelector("h1")?.textContent?.trim() || title;
      const bodyHtml = doc.body?.innerHTML?.trim() || "<p></p>";

      setTitle(importedTitle);
      editor.commands.setContent(bodyHtml);
      setSaveStatus("dirty");
      flushAfterImageChange();

      if (skippedImageSrcList.length > 0) {
        alert(`取り込めなかった画像: ${skippedImageSrcList.join(", ")}`);
      }
    } catch {
      alert("HTMLの読み込みに失敗しました");
    } finally {
      event.target.value = "";
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }

    dragDepthRef.current += 1;
    setIsDraggingImage(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingImage(false);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingImage(false);

    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await insertUploadedImage(file);
    }
  };

  return {
    fileActions: {
      handleImageSelected,
      handleImportHtml,
      handlePickHtml,
      handlePickImage,
    },
    imageUrl,
    isDraggingImage,
    isFetchingLinkPreview,
    isUploadingImage,
    linkUrl,
    setImageUrl,
    setLinkUrl,
    uploadActions: {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleInsertImage,
      handleInsertLinkCard,
    },
  };
}
