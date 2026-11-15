/** An image given to the model (screenshot or reference). */
export interface ModelImage {
  /** `data:image/png;base64,…` or an https URL. */
  url: string;
  mimeType: string;
}

export interface ModelRequest {
  /** Standing instructions: what Bestenberg is and the output contract. */
  system: string;
  /** The single user turn for this call (the pipeline is stateless between rounds). */
  prompt: string;
  images?: ModelImage[];
}

/**
 * One way of reaching a language model. Implementations: the WordPress AI
 * Client through the plugin's REST route (bring your own key), the hosted
 * Bestenberg service, and scripted providers for tests (PLAN.md §6).
 */
export interface ModelProvider {
  /** Returns the model's text, expected to contain one JSON object. */
  generate(request: ModelRequest): Promise<string>;
}

/** Provider that replays scripted answers; records the requests it received. */
export function scriptedProvider(
  answers: ReadonlyArray<string | ((request: ModelRequest) => string)>,
): ModelProvider & { requests: ModelRequest[] } {
  const requests: ModelRequest[] = [];
  return {
    requests,
    generate(request) {
      const answer = answers[requests.length];
      requests.push(request);
      if (answer === undefined) return Promise.reject(new Error('No scripted answer left'));
      return Promise.resolve(typeof answer === 'function' ? answer(request) : answer);
    },
  };
}
