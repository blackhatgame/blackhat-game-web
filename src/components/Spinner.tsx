import { useState } from "react"
import { useInterval } from "./useInterval";

const spinnerChars = [
    '⡿',
    '⣟',
    '⣯',
    '⣷',
    '⣾',
    '⣽',
    '⣻',
    '⢿'
  ]

  export default function Spinner() {
    const [tick, setTick] = useState(0);

    useInterval(() => {
        setTick((tick + 1) % spinnerChars.length)
    }, 100)

    return spinnerChars[tick];
  }