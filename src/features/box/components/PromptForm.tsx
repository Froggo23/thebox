import { FormEvent, useState } from 'react';

type Props = {
  disabled?: boolean;
  onSubmit: (prompt: string) => void | Promise<void>;
};

export function PromptForm({ disabled, onSubmit }: Props) {
  const [value, setValue] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const prompt = value.trim();
    if (!prompt || disabled) return;
    await onSubmit(prompt);
    setValue('');
  }

  return (
    <form className="prompt-form" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="box-prompt">
        What should we add to the box?
      </label>
      <input
        id="box-prompt"
        className="prompt-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='e.g. "add a red hat" or "put sunglasses on it"'
        maxLength={500}
        disabled={disabled}
        autoComplete="off"
      />
      <button className="btn primary" type="submit" disabled={disabled || !value.trim()}>
        Transform
      </button>
    </form>
  );
}
