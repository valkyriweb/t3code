import type { OrchestrationV2UserInputQuestion } from "@t3tools/contracts";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { PiRpcRecord } from "./rpc.ts";

// Wire contract with my-pi's pi-async-ask extension. Ordinary RPC editors remain editors.
export const PI_ASYNC_ASK_TITLE = "my-pi.async-ask/v1";

const decodeQuestion = Schema.decodeUnknownOption(
  Schema.fromJsonString(
    Schema.Struct({
      id: Schema.String,
      header: Schema.String,
      question: Schema.String,
      options: Schema.Array(Schema.Struct({ label: Schema.String, description: Schema.String })),
      multiSelect: Schema.optional(Schema.Boolean),
    }),
  ),
);

export function piAsyncAskQuestion(event: PiRpcRecord): OrchestrationV2UserInputQuestion | null {
  const decoded = Option.getOrUndefined(decodeQuestion(event["prefill"]));
  if (
    decoded === undefined ||
    !decoded.id.trim() ||
    !decoded.header.trim() ||
    !decoded.question.trim() ||
    decoded.options.length < 2 ||
    decoded.options.length > 4 ||
    decoded.options.some((option) => !option.label.trim()) ||
    new Set(decoded.options.map((option) => option.label)).size !== decoded.options.length
  ) {
    return null;
  }
  return {
    id: decoded.id,
    header: decoded.header.trim(),
    question: decoded.question.trim(),
    options: decoded.options.map(({ label, description }) => ({
      label: label.trim(),
      description: description.trim() || label.trim(),
      value: label,
    })),
    multiSelect: decoded.multiSelect === true,
    allowCustomAnswer: true,
    required: true,
  };
}

export function piAsyncAskAnswer(
  question: OrchestrationV2UserInputQuestion,
  answer: unknown,
): string | undefined {
  const offered = (value: unknown): value is string =>
    typeof value === "string" && question.options.some((option) => option.value === value);
  if (typeof answer === "string" && answer.trim()) {
    return JSON.stringify(
      !question.multiSelect && offered(answer)
        ? { selections: [answer], other: "" }
        : { selections: [], other: answer },
    );
  }
  if (
    question.multiSelect &&
    Array.isArray(answer) &&
    answer.length > 0 &&
    answer.every(offered) &&
    new Set(answer).size === answer.length
  ) {
    return JSON.stringify({ selections: answer, other: "" });
  }
  return undefined;
}
