import type {
  ExcalidrawElement,
  ExcalidrawGenericElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawImageElement,
  FileId,
  ExcalidrawFrameElement,
  ExcalidrawElementType,
  ExcalidrawMagicFrameElement,
} from "../../element/types";
import { newElement, newTextElement, newLinearElement } from "../../element";
import { DEFAULT_VERTICAL_ALIGN, ROUNDNESS } from "../../constants";
import { getDefaultAppState } from "../../appState";
import { GlobalTestState, createEvent, fireEvent, act } from "../test-utils";
import fs from "fs";
import util from "util";
import path from "path";
import { getMimeType } from "../../data/blob";
import {
  newArrowElement,
  newEmbeddableElement,
  newFrameElement,
  newFreeDrawElement,
  newIframeElement,
  newImageElement,
  newMagicFrameElement,
} from "../../element/newElement";
import type { AppState } from "../../types";
import { getSelectedElements } from "../../scene/selection";
import { isLinearElementType } from "../../element/typeChecks";
import type { Mutable } from "../../utility-types";
import { assertNever } from "../../utils";
import type App from "../../components/App";
import { createTestHook } from "../../components/App";
import type { Action } from "../../actions/types";
import { mutateElement } from "../../element/mutateElement";
import { point, type LocalPoint, type Radians } from "../../../math";

const readFile = util.promisify(fs.readFile);
// so that window.h is available when App.tsx is not imported as well.
createTestHook();

const { h } = window;

export class API {
  static updateScene: InstanceType<typeof App>["updateScene"] = (...args) => {
    act(() => {
      h.app.updateScene(...args);
    });
  };
  static setAppState: React.Component<any, AppState>["setState"] = (
    state,
    cb,
  ) => {
    act(() => {
      h.setState(state, cb);
    });
  };

  static setElements = (elements: readonly ExcalidrawElement[]) => {
    act(() => {
      h.elements = elements;
    });
  };

  static setSelectedElements = (elements: ExcalidrawElement[]) => {
    act(() => {
      h.setState({
        selectedElementIds: elements.reduce((acc, element) => {
          acc[element.id] = true;
          return acc;
        }, {} as Record<ExcalidrawElement["id"], true>),
      });
    });
  };

  static updateElement = (
    ...[element, updates]: Parameters<typeof mutateElement>
  ) => {
    act(() => {
      mutateElement(element, updates);
    });
  };

  static getSelectedElements = (
    includeBoundTextElement: boolean = false,
    includeElementsInFrames: boolean = false,
  ): ExcalidrawElement[] => {
    return getSelectedElements(h.elements, h.state, {
      includeBoundTextElement,
      includeElementsInFrames,
    });
  };

  static getSelectedElement = (): ExcalidrawElement => {
    const selectedElements = API.getSelectedElements();
    if (selectedElements.length !== 1) {
      throw new Error(
        `expected 1 selected element; got ${selectedElements.length}`,
      );
    }
    return selectedElements[0];
  };

  static getUndoStack = () => {
    // @ts-ignore
    return h.history.undoStack;
  };

  static getRedoStack = () => {
    // @ts-ignore
    return h.history.redoStack;
  };

  static getSnapshot = () => {
    return Array.from(h.store.snapshot.elements.values());
  };

  static clearSelection = () => {
    act(() => {
      // @ts-ignore
      h.app.clearSelection(null);
    });
    expect(API.getSelectedElements().length).toBe(0);
  };

  static createElement = <
    T extends Exclude<ExcalidrawElementType, "selection"> = "rectangle",
  >({
    // @ts-ignore
    type = "rectangle",
    id,
    x = 0,
    y = x,
    width = 100,
    height = width,
    isDeleted = false,
    groupIds = [],
    ...rest
  }: {
    type?: T;
    x?: number;
    y?: number;
    height?: number;
    width?: number;
    angle?: number;
    id?: string;
    isDeleted?: boolean;
    frameId?: ExcalidrawElement["id"] | null;
    index?: ExcalidrawElement["index"];
    groupIds?: string[];
    // generic element props
    strokeColor?: ExcalidrawGenericElement["strokeColor"];
    backgroundColor?: ExcalidrawGenericElement["backgroundColor"];
    fillStyle?: ExcalidrawGenericElement["fillStyle"];
    strokeWidth?: ExcalidrawGenericElement["strokeWidth"];
    strokeStyle?: ExcalidrawGenericElement["strokeStyle"];
    roundness?: ExcalidrawGenericElement["roundness"];
    roughness?: ExcalidrawGenericElement["roughness"];
    opacity?: ExcalidrawGenericElement["opacity"];
    // text props
    text?: T extends "text" ? ExcalidrawTextElement["text"] : never;
    fontSize?: T extends "text" ? ExcalidrawTextElement["fontSize"] : never;
    fontFamily?: T extends "text" ? ExcalidrawTextElement["fontFamily"] : never;
    textAlign?: T extends "text" ? ExcalidrawTextElement["textAlign"] : never;
    verticalAlign?: T extends "text"
      ? ExcalidrawTextElement["verticalAlign"]
      : never;
    boundElements?: ExcalidrawGenericElement["boundElements"];
    containerId?: T extends "text"
      ? ExcalidrawTextElement["containerId"]
      : never;
    points?: T extends "arrow" | "line" ? readonly LocalPoint[] : never;
    locked?: boolean;
    fileId?: T extends "image" ? string : never;
    scale?: T extends "image" ? ExcalidrawImageElement["scale"] : never;
    status?: T extends "image" ? ExcalidrawImageElement["status"] : never;
    startBinding?: T extends "arrow"
      ? ExcalidrawLinearElement["startBinding"]
      : never;
    endBinding?: T extends "arrow"
      ? ExcalidrawLinearElement["endBinding"]
      : never;
    elbowed?: boolean;
  }): T extends "arrow" | "line"
    ? ExcalidrawLinearElement
    : T extends "freedraw"
    ? ExcalidrawFreeDrawElement
    : T extends "text"
    ? ExcalidrawTextElement
    : T extends "image"
    ? ExcalidrawImageElement
    : T extends "frame"
    ? ExcalidrawFrameElement
    : T extends "magicframe"
    ? ExcalidrawMagicFrameElement
    : ExcalidrawGenericElement => {
    let element: Mutable<ExcalidrawElement> = null!;

    const appState = h?.state || getDefaultAppState();

    const base: Omit<
      ExcalidrawGenericElement,
      | "id"
      | "width"
      | "height"
      | "type"
      | "seed"
      | "version"
      | "versionNonce"
      | "isDeleted"
      | "groupIds"
      | "link"
      | "updated"
    > = {
      x,
      y,
      frameId: rest.frameId ?? null,
      index: rest.index ?? null,
      angle: (rest.angle ?? 0) as Radians,
      strokeColor: rest.strokeColor ?? appState.currentItemStrokeColor,
      backgroundColor:
        rest.backgroundColor ?? appState.currentItemBackgroundColor,
      fillStyle: rest.fillStyle ?? appState.currentItemFillStyle,
      strokeWidth: rest.strokeWidth ?? appState.currentItemStrokeWidth,
      strokeStyle: rest.strokeStyle ?? appState.currentItemStrokeStyle,
      roundness: (
        rest.roundness === undefined
          ? appState.currentItemRoundness === "round"
          : rest.roundness
      )
        ? {
            type: isLinearElementType(type)
              ? ROUNDNESS.PROPORTIONAL_RADIUS
              : ROUNDNESS.ADAPTIVE_RADIUS,
          }
        : null,
      roughness: rest.roughness ?? appState.currentItemRoughness,
      opacity: rest.opacity ?? appState.currentItemOpacity,
      boundElements: rest.boundElements ?? null,
      locked: rest.locked ?? false,
    };
    switch (type) {
      case "rectangle":
      case "diamond":
      case "ellipse":
        element = newElement({
          type: type as "rectangle" | "diamond" | "ellipse",
          width,
          height,
          ...base,
        });
        break;
      case "embeddable":
        element = newEmbeddableElement({
          type: "embeddable",
          ...base,
        });
        break;
      case "iframe":
        element = newIframeElement({
          type: "iframe",
          ...base,
        });
        break;
      case "text":
        const fontSize = rest.fontSize ?? appState.currentItemFontSize;
        const fontFamily = rest.fontFamily ?? appState.currentItemFontFamily;
        element = newTextElement({
          ...base,
          text: rest.text || "test",
          fontSize,
          fontFamily,
          textAlign: rest.textAlign ?? appState.currentItemTextAlign,
          verticalAlign: rest.verticalAlign ?? DEFAULT_VERTICAL_ALIGN,
          containerId: rest.containerId ?? undefined,
        });
        element.width = width;
        element.height = height;
        break;
      case "freedraw":
        element = newFreeDrawElement({
          type: type as "freedraw",
          simulatePressure: true,
          ...base,
        });
        break;
      case "arrow":
        element = newArrowElement({
          ...base,
          width,
          height,
          type,
          points: rest.points ?? [
            point<LocalPoint>(0, 0),
            point<LocalPoint>(100, 100),
          ],
          elbowed: rest.elbowed ?? false,
        });
        break;
      case "line":
        element = newLinearElement({
          ...base,
          width,
          height,
          type,
          points: rest.points ?? [
            point<LocalPoint>(0, 0),
            point<LocalPoint>(100, 100),
          ],
        });
        break;
      case "image":
        element = newImageElement({
          ...base,
          width,
          height,
          type,
          fileId: (rest.fileId as string as FileId) ?? null,
          status: rest.status || "saved",
          scale: rest.scale || [1, 1],
        });
        break;
      case "frame":
        element = newFrameElement({ ...base, width, height });
        break;
      case "magicframe":
        element = newMagicFrameElement({ ...base, width, height });
        break;
      default:
        assertNever(
          type,
          `API.createElement: unimplemented element type ${type}}`,
        );
        break;
    }
    if (element.type === "arrow") {
      element.startBinding = rest.startBinding ?? null;
      element.endBinding = rest.endBinding ?? null;
    }
    if (id) {
      element.id = id;
    }
    if (isDeleted) {
      element.isDeleted = isDeleted;
    }
    if (groupIds) {
      element.groupIds = groupIds;
    }
    return element as any;
  };

  static readFile = async <T extends "utf8" | null>(
    filepath: string,
    encoding?: T,
  ): Promise<T extends "utf8" ? string : Buffer> => {
    filepath = path.isAbsolute(filepath)
      ? filepath
      : path.resolve(path.join(__dirname, "../", filepath));
    return readFile(filepath, { encoding }) as any;
  };

  static loadFile = async (filepath: string) => {
    const { base, ext } = path.parse(filepath);
    return new File([await API.readFile(filepath, null)], base, {
      type: getMimeType(ext),
    });
  };

  static drop = async (blob: Blob) => {
    const fileDropEvent = createEvent.drop(GlobalTestState.interactiveCanvas);
    const text = await new Promise<string>((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.readAsText(blob);
      } catch (error: any) {
        reject(error);
      }
    });

    const files = [blob] as File[] & { item: (index: number) => File };
    files.item = (index: number) => files[index];

    Object.defineProperty(fileDropEvent, "dataTransfer", {
      value: {
        files,
        getData: (type: string) => {
          if (type === blob.type) {
            return text;
          }
          return "";
        },
      },
    });
    await fireEvent(GlobalTestState.interactiveCanvas, fileDropEvent);
  };

  static executeAction = (action: Action) => {
    act(() => {
      h.app.actionManager.executeAction(action);
    });
  };
}
