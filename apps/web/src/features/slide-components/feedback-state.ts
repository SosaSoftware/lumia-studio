/** How a message of a component looks once it is shown: the colors of a correct answer, of a wrong one, or none. */
export type FeedbackTone = 'success' | 'failure' | 'neutral';

/** One message a component can show after the student acts on it, such as the one of a correct answer. */
export interface FeedbackState {
  /** Identifies the state among the others of the component. */
  readonly key: string;
  /** Text of the button that shows the message. */
  readonly label: string;
  readonly message: string;
  /** Bold line above the message, for components whose message has a title. */
  readonly heading?: string;
  readonly tone: FeedbackTone;
}
