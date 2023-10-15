import React, { useState, useEffect, useRef, KeyboardEvent, ChangeEvent, ReactNode, ReactNodeArray, RefObject, ForwardedRef, forwardRef } from 'react';
import { useInterval } from './useInterval';
import Spinner from './Spinner';
import { useGame } from '@/hooks/useGame';

export enum ColorMode {
  Light,
  Dark
}

const TerminalInput = ({children} : {children: string}) => {
return (
    <div className="react-terminal-line react-terminal-input">{ children }</div>
);
} 

const TerminalOutput = ({children, onDone} : {children: string, onDone?: () => void}) => {
    const [typedString, setTypedString] = useState('');
    const [done, setDone] = useState(false);
    useInterval(() => {
        if (typedString.length < children.length) {
            setTypedString(children.slice(0 , typedString.length + 1))
        } else if (!done) {
            setDone(true)
        }
    }, 10)
    useEffect(() => {
        if (done && onDone) {
            onDone();
        }
    }, [done])
return (
    <div className="react-terminal-line text-sky-500 whitespace-pre-line">{ typedString }</div>
);
} 

export interface Props {
    currentLineInput: string, 
    setCurrentLineInput: (arg: string) => void,
  name?: string;
  prompt?: string;
  gameStatus?: string;
  isSuggestion: boolean;
  isWaiting: boolean;
  colorMode?: ColorMode;
  currentScore?: number;
  handleAccept: (arg: number) => void;
  children?: ReactNode;
  scrollRef: ReactNode;
  onInput?: ((input: string) => void) | null | undefined;
  startingInputValue?: string;
  username?: string;
  pretext?: string | null;
  redBtnCallback?: () => void;
  yellowBtnCallback?: () => void;
  greenBtnCallback?: () => void;
}

const Terminal = ({
    currentLineInput,
    isSuggestion,
    username,
    gameStatus,
    isWaiting,
    currentScore,
    handleAccept,
    scrollRef,
    pretext,
    setCurrentLineInput,
    name, prompt, colorMode, onInput, children, startingInputValue = "", redBtnCallback, yellowBtnCallback, greenBtnCallback
}: Props) => {
  const [cursorPos, setCursorPos] = useState(0);
  const {wager, submitGame} = useGame();

  const updateCurrentLineInput = (event: ChangeEvent<HTMLInputElement>) => {
    setCurrentLineInput(event.target.value);
  }

  
  // Calculates the total width in pixels of the characters to the right of the cursor.
  // Create a temporary span element to measure the width of the characters.
  const calculateInputWidth = (inputElement: HTMLInputElement, chars: string) => {
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.fontSize = window.getComputedStyle(inputElement).fontSize;
    span.style.fontFamily = window.getComputedStyle(inputElement).fontFamily;
    span.innerText = chars;
    document.body.appendChild(span);
    const width = span.getBoundingClientRect().width;
    document.body.removeChild(span);
    // Return the negative width, since the cursor position is to the left of the input suffix
    return -width;
  };

  const clamp = (value: number, min: number, max: number) => {
    if(value > max) return max;
    if(value < min) return min;
    return value;
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if(!onInput) {
      return;
    };
    if (event.key === 'Enter') {
      onInput(currentLineInput);
      setCursorPos(0);
      setCurrentLineInput('');
    } else if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Delete"].includes(event.key)) { 
      const inputElement = event.currentTarget;
      let charsToRightOfCursor = "";
      let cursorIndex = currentLineInput.length - (inputElement.selectionStart || 0);
      cursorIndex = clamp(cursorIndex, 0, currentLineInput.length);

      if(event.key === 'ArrowLeft') {
        if(cursorIndex > currentLineInput.length - 1) cursorIndex --;
        charsToRightOfCursor = currentLineInput.slice(currentLineInput.length -1 - cursorIndex);
      }
      else if (event.key === 'ArrowRight' || event.key === 'Delete') {
        charsToRightOfCursor = currentLineInput.slice(currentLineInput.length - cursorIndex + 1);
      }
      else if (event.key === 'ArrowUp') {
        charsToRightOfCursor = currentLineInput.slice(0)
      }

      const inputWidth = calculateInputWidth(inputElement, charsToRightOfCursor);
      setCursorPos(inputWidth);
    }
  }

  useEffect(() => {
    setCurrentLineInput(startingInputValue.trim());
  }, [startingInputValue]);


  const reward = parseFloat(currentLineInput) * 10;
  // We use a hidden input to capture terminal input; make sure the hidden input is focused when clicking anywhere on the terminal
  useEffect(() => {
    if (onInput == null) {
      return;
    }
    // keep reference to listeners so we can perform cleanup
    const elListeners: { terminalEl: Element; listener: EventListenerOrEventListenerObject }[] = [];
    for (const terminalEl of document.getElementsByClassName('react-terminal-wrapper')) {
      const listener = () => (terminalEl?.querySelector('.terminal-hidden-input') as HTMLElement)?.focus();
      terminalEl?.addEventListener('click', listener);
      elListeners.push({ terminalEl, listener });
    }
    return function cleanup () {
      elListeners.forEach(elListener => {
        elListener.terminalEl.removeEventListener('click', elListener.listener);
      });
    }
  }, [onInput]);

  const classes = ['react-terminal-wrapper'];
  if (colorMode === ColorMode.Light) {
    classes.push('react-terminal-light');
  }
  return (
    <div className={ classes.join(' ') } data-terminal-name={ name }>
      <div className="react-terminal-window-buttons">
        <button className={`${yellowBtnCallback ? "clickable": ""} red-btn`} disabled={!redBtnCallback} onClick={ redBtnCallback } />
        <button className={`${yellowBtnCallback ? "clickable" : ""} yellow-btn`} disabled={!yellowBtnCallback} onClick={ yellowBtnCallback } />
        <button className={`${greenBtnCallback ? "clickable" : ""} green-btn`} disabled={!greenBtnCallback} onClick={ greenBtnCallback } />
      </div>
      <div className="react-terminal" style={ { height: '100%' } }>
        { children }
        { onInput && <div className={`react-terminal-line react-terminal-input  react-terminal-active-input${isSuggestion ? ' opacity-30' : ''}`} data-terminal-prompt={ prompt || `${username ? `${username}@` : ''}root:$` } key="terminal-line-prompt" >{pretext}{pretext && <span className='border text-xs px-1 float-right'>{gameStatus==='sendWager' && reward ? `Win up to ${reward} SOL` :`Enter ⏎`}</span>}{ currentLineInput }{isWaiting ? <Spinner/> : <span className="cursor" style={{ left: `${cursorPos+1}px` }}/>}{isSuggestion && <span className='border text-xs px-1 float-right'>Tab ↹</span>}</div> }
        {scrollRef}
      </div>
      <input className='terminal-hidden-input' placeholder="Terminal Hidden Input" value={ currentLineInput } autoFocus={ onInput != null } onChange={ updateCurrentLineInput } onKeyDown={ handleInputKeyDown }/>
      {currentScore ? <div className='w-100 flex justify-center mt-1'><span onClick={() => handleAccept(currentScore)} className='border px-1'>Accept offer: {currentScore}% ({wager * currentScore / 10} SOL)</span></div> : null}
    </div>
  );
}

export { TerminalInput, TerminalOutput };

export default forwardRef(Terminal);
