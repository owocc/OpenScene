import z from "zod";

const ButtonPropsSchema = z.object({
  label: z.string(),
});

export function Button(props: z.output<typeof ButtonPropsSchema>) {
  return <button>{props.label}</button>;
}
