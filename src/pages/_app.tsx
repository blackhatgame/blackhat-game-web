import '@/styles/globals.css'

import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
    WalletModalProvider,
    WalletDisconnectButton,
    WalletMultiButton,
    useWalletModal
} from '@solana/wallet-adapter-react-ui';
import Terminal, { ColorMode, TerminalOutput, TerminalInput } from '../components/Terminal';
import { useGame } from '@/hooks/useGame';
import GameProvider from '@/hooks/useGame';


require('@solana/wallet-adapter-react-ui/styles.css');

const initialHackerReply = `Look, I know you're here to negotiate, but I won't give in easily. I've got my limits. What's your offer for the return of the funds?`

const TerminalController = () => {
  const scrollIntoViewRef = useRef<HTMLDivElement>(null)
  const [currentLineInput, setCurrentLineInput] = useState('');
  const { disconnect, publicKey } = useWallet();
  const [currentScore, setCurrentScore] = useState<number>(0);
  const { requestGame, joinGame, gameId, submitGame, wager} = useGame();
  const [pretext, setPretext] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [gameStatus, setGameStatus] = useState('unconnected');
  const [walletStatus, setWalletStatus] = useState<'connecting' | 'disconnecting' | 'idle'>('idle');
  const {setVisible} = useWalletModal();
  const [isSuggestionString, setIsSuggestionString] = useState<boolean>(false);
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant' | 'system',
    content: string,
    skip?: boolean
  }>>([]);

  useEffect(() => {
    console.log(gameStatus);
    if (gameStatus === 'gameStart') {
      setMessages(messages.concat({
        role: 'assistant',
        content: initialHackerReply,
      }))
    }
    if (gameStatus === 'unconnected') {
      setPretext('/connect');
    }
    if (gameStatus === 'connected') {
      setMessages(messages.concat({
        content: `dev: hey, u up?
        dev: need your help with something urgent
        dev: bad news, our DeFi protocol got hacked. good news, we're in contact with the hacker and they're willing to negotiate.
        dev: I heard you're an expert negotiator. you were also a depositor, right?`,
        role: 'system',
        skip: true,
      }))
      setPretext('yeah...');
    }
    if (gameStatus === 'sendWager') {
      setMessages(messages.concat({
        content: `dev: tell you what, if you negotiate with the hacker, we'll offer you a prize based on your performance. the percentage you retrieve will be a multiplier on your deposit. so if you retrieve 100%, you get 10x. if you retrieve 10%, you get your full deposit back (1x). same goes for anything in between. if you get 0% back... tough luck.
        dev: how much did you have deposited?`,
        role: 'system',
        skip: true,
      }))
    }
  }, [gameStatus])

  function handleInput(input: string) {
    if (gameStatus === 'sendWager') {
      const regex = /^(?:\d*(\.\d*)?)?$/;

      if (input.match(regex)) {
        setCurrentLineInput(input)
      }
    } else if (gameStatus === 'initial') {
      
    } else {
      setCurrentLineInput(input)
    }
  } 

  const styledMessages = useMemo(() => messages.map((message) => message.role === 'user' ? <TerminalInput key={message.content}>{message.content}</TerminalInput> : 
    <TerminalOutput key={message.content} onDone={() => {
      scrollIntoViewRef?.current?.scrollIntoView({ behavior: "auto", block: "nearest" })
    }}>{message.content}</TerminalOutput>), [messages])

  async function makeInitialCall(message: string) {
    setIsWaiting(true)
    const response = await fetch("/api/openai", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: messages.filter(x => !x.skip).concat({
        content: message,
        role: 'user'
      }),
      gameId,
    }),
    })

    const responseJson = await response.json();

    setMessages(
      messages.concat(
        {
          content: message,
          role: 'user'
        },
        {
          content: responseJson.response,
          role: 'assistant'
        }
      )
    )
    handleInput(responseJson.suggestion);
    setIsSuggestionString(
      true
    )
    setCurrentScore(responseJson.currentScore);
    setIsWaiting(false)
  }


  useEffect(() => {
    const keyDownHandler = (event: any) => {
      if (isWaiting) {
        event.preventDefault();
        return;
      }

      if (event.key === 'Tab' && isSuggestionString) {
        event.preventDefault();
        setIsSuggestionString(false);
      } else if (isSuggestionString) {
        handleInput('')
        setIsSuggestionString(false);
      }
    };

    document.addEventListener('keydown', keyDownHandler);

    return () => {
      document.removeEventListener('keydown', keyDownHandler);
    };
  }, [isSuggestionString, isWaiting]);

  useEffect(() => {
    if (walletStatus === 'connecting') {
      setMessages(messages.concat({
        content: `User ${publicKey} connected!`,
        role: 'system',
        skip: true,
      }));
      setGameStatus('connected');
    } else if (walletStatus === 'disconnecting') {
      setMessages(messages.concat({
        content: `User ${publicKey} disconnected!`,
        role: 'system',
        skip: true,
      }));
      disconnect();
    }
  }, [walletStatus]);

  useEffect(() => {
    if (publicKey) {
      setWalletStatus('connecting');
    }
  }, [publicKey])

  useEffect(() => {
    if (scrollIntoViewRef.current) { // skip scrolldown when the component first loads
      scrollIntoViewRef?.current?.scrollIntoView({ behavior: "auto", block: "nearest" })
    }
  }, [styledMessages, currentLineInput]);


  async function handleAccept(percentage: number) {
    if (1) {
      await submitGame(currentScore);
      setMessages(messages.concat({
        content: `dev: hmm so he agreed to return ${percentage}%?
        dev: I think we can live with that.
        dev: As promised, here's your reward of ${wager * currentScore / 10} SOL.`,
        role: 'system',
        skip: true,
      }));
    }
  }

  // Terminal has 100% width by default so it should usually be wrapped in a container div
  return (
    <>
       <Terminal
        redBtnCallback={() => {
          disconnect();
          setWalletStatus('disconnecting');
          setGameStatus('unconnected');
        }}
        isSuggestion={isSuggestionString}
        handleAccept={handleAccept}
        gameStatus={gameStatus}
        currentLineInput={currentLineInput}
        scrollRef={<div id='scrollRef' ref={scrollIntoViewRef}/>}
        pretext={pretext}
        setCurrentLineInput={handleInput}
        currentScore={currentScore}
        username={publicKey ? `${publicKey.toBase58().slice(0,4)}` : undefined}
        isWaiting={isWaiting}
        name='BlackHat game' colorMode={ ColorMode.Dark } 
        onInput={async terminalInput => {
          
          const token = terminalInput.trim();
          const regex = /^(0|[1-9]\d*)(\.\d+)?$/;
          const match = terminalInput.match(regex);

          if (token === '/disconnect') {
            setMessages(messages.concat(
              {
                content: terminalInput,
                role: 'user',
                skip: true,
              }));
              disconnect();
              setWalletStatus('disconnecting');
              setGameStatus('unconnected');
            }

          switch (gameStatus) {
            case 'unconnected':
              setMessages(messages.concat({
                content: '/connect',
                role: 'user',
                skip: true,
              }));
              setVisible(true)
              break;
            case 'connected':
              setMessages(messages.concat({
                content: 'yeah...',
                role: 'user',
                skip: true,
              }));
              setGameStatus('sendWager')
              setPretext('enter number (wager in SOL): ')
              break;
            case 'sendWager':
              if (match) {
                if (terminalInput !== '0') {
                    const firstMessages = messages.concat(
                      {
                        content: 'enter number (wager in SOL): ' + terminalInput,
                        role: 'user',
                        skip: true,
                      }).concat(
                      {
                        content: `Alright... approve the transactions to continue the game...`,
                        role: 'system',
                        skip: true,
                      }
                    );
                    setMessages(firstMessages);
                    setCurrentLineInput('');
                    setIsWaiting(true);
                    await requestGame(Number(match[1]));
                    setMessages(firstMessages.concat(
                      {
                        content: `Wagering funds...`,
                        role: 'system',
                        skip: true,
                      }));
                    await joinGame();
                    setIsWaiting(false);
                } else {
                  setMessages(messages.concat({
                  content: 'enter number (wager in SOL): ' + terminalInput,
                  role: 'user',
                  skip: true,
                }));
                setGameStatus('gameStart');
                setPretext(null);
              } 
            } else {
              console.error('Invalid amount to send.')
            }
              break;
            case 'gameStart':
            if (publicKey) {
              if (!isWaiting) {
                setMessages(messages.concat(
                {
                  content: terminalInput,
                  role: 'user',
                  skip: false,
                }))
                makeInitialCall(terminalInput);
              }
            } else {
              setMessages(messages.concat(
              {
                content: terminalInput,
                role: 'user',
                skip: true,
              }).concat(
              {
                content: `Please connect your wallet with /connect first.`,
                role: 'system',
                skip: true,
              }));
            }
          break;
            default:
              console.error('Invalid game states');
          }
        }}
      >
      <pre key='ascii_art' className='text-center text'>
        <code className='text-sky-500'>{`
  ___ _      _   ___ _  __
 | _ ) |    /_\\ / __| |/ /
 | _ \\ |__ / _ \\ (__| ' < 
 |___/____/_/_\\_\\___|_|\\_\\
 | || | /_\\_   _|         
 | __ |/ _ \\| |           
 |_||_/_/_\\_\\_|  __ ___   
  / __| /_\\ |  \\/  | __|  
 | (_ |/ _ \\| |\\/| | _|   
\\___/_/ \\_\\_|  |_|___|
    `}</code>
      </pre>
        { styledMessages }
      </Terminal>
</>
  )
};

export default function App() {

  const wallets = useMemo(
    () => [
        new PhantomWalletAdapter(),
    ],
    []
);

  return <ConnectionProvider endpoint={'https://api.devnet.solana.com'}>
      <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <GameProvider>
            <TerminalController/> 
              </GameProvider>
            </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>}