export class InputError extends Error {}
type Values<S extends Record<string, Rule<unknown>>> = { [K in keyof S]: S[K] extends Rule<infer T> ? T : never };
class Rule<T> {
  readonly parse: (value: unknown) => T;
  constructor(parse: (value: unknown) => T) { this.parse = parse; }
  refine(test: (value: T) => boolean, message = 'Check the information you entered.') {
    return new Rule<T>(value => {
      const result = this.parse(value);
      if (!test(result)) throw new InputError(message);
      return result;
    });
  }
  safeParse(value: unknown): { success: true; data: T } | { success: false } {
    try { return { success: true, data: this.parse(value) }; }
    catch (error) { if (error instanceof InputError) return { success: false }; throw error; }
  }
  optional() { return new Rule(value => value === undefined ? undefined : this.parse(value)); }
  default(fallback: T) { return new Rule(value => value === undefined ? fallback : this.parse(value)); }
}
class StringRule extends Rule<string> {
  trim() { return new StringRule(value => this.parse(value).trim()); }
  toUpperCase() { return new StringRule(value => this.parse(value).toUpperCase()); }
  regex(pattern: RegExp, message = 'Check the text you entered.') {
    return new StringRule(this.refine(value => pattern.test(value), message).parse);
  }
  min(size: number) { return new StringRule(this.refine(value => value.length >= size, `Use at least ${size} characters.`).parse); }
  max(size: number) { return new StringRule(this.refine(value => value.length <= size, `Use at most ${size} characters.`).parse); }
  uuid() { return this.regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i); }
}
class NumberRule extends Rule<number> {
  int() { return new NumberRule(this.refine(Number.isInteger, 'Use a whole number.').parse); }
  min(min: number) { return new NumberRule(this.refine(value => value >= min, `Minimum value is ${min}.`).parse); }
  max(max: number) { return new NumberRule(this.refine(value => value <= max, `Maximum value is ${max}.`).parse); }
  nonnegative() { return this.min(0); }
}
class ArrayRule<T> extends Rule<T[]> {
  min(min: number) { return new ArrayRule(this.refine(items => items.length >= min, `Provide at least ${min} entries.`).parse); }
  max(max: number) { return new ArrayRule(this.refine(items => items.length <= max, `Provide at most ${max} entries.`).parse); }
}
class ObjectRule<S extends Record<string, Rule<unknown>>> extends Rule<Values<S>> {
  private readonly fields: S;
  constructor(fields: S) {
    super(input => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('Provide a JSON object.');
      const value = input as Record<string, unknown>;
      return Object.fromEntries(Object.entries(fields).flatMap(([key, rule]) => {
        const result = rule.parse(Object.hasOwn(value, key) ? value[key] : undefined);
        return result === undefined ? [] : [[key, result]];
      })) as Values<S>;
    });
    this.fields = fields;
  }
  extend<R extends Record<string, Rule<unknown>>>(fields: R) { return new ObjectRule({ ...this.fields, ...fields }); }
  partial() { return new ObjectRule(Object.fromEntries(Object.entries(this.fields).map(([key, rule]) => [key, rule.optional()]))); }
}
function expect<T>(value: unknown, condition: boolean, message: string): T {
  if (!condition) throw new InputError(message);
  return value as T;
}
export const input = {
  string: () => new StringRule(value => expect<string>(value, typeof value === 'string', 'Enter text.')),
  number: () => new NumberRule(value => expect<number>(value, typeof value === 'number' && Number.isFinite(value), 'Enter a number.')),
  boolean: () => new Rule(value => expect<boolean>(value, typeof value === 'boolean', 'Choose true or false.')),
  enum: <const T extends readonly string[]>(values: T) => new Rule(value => expect<T[number]>(value, typeof value === 'string' && values.includes(value), 'Choose an available option.')),
  object: <S extends Record<string, Rule<unknown>>>(fields: S) => new ObjectRule(fields),
  array: <T>(rule: Rule<T>) => new ArrayRule(value => expect<unknown[]>(value, Array.isArray(value), 'Provide a list.').map(item => rule.parse(item))),
};
