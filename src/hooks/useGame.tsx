import * as anchor from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js';
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IDL, Blackhat } from '../program';

export type ResultType = {

};
export interface GameProviderContext {
  gameId: PublicKey | null;
  result: ResultType | null;
  setResult: (result: ResultType) => void;
  requestGame: (amount: number) => Promise<number | undefined>;
  joinGame: () => Promise<PublicKey | undefined>;
  submitGame: (amount: number) => Promise<PublicKey | undefined>;
  wager: number;
  anchorProgram: anchor.Program<Blackhat> | null
}

const GameContext = React.createContext<GameProviderContext>({
  gameId: null,
  result: {},
  setResult: () => {
    throw new Error('GameProvider not initialized');
  },
  requestGame: () => {
    throw new Error('GameProvider not initialized');
  },
  joinGame: () => {
    throw new Error('GameProvider not initialized');
  },
  submitGame: () => {
    throw new Error('GameProvider not initialized');
  },
  wager: 0,
  anchorProgram: null
});

export default function GameProvider(props: {children: ReactNode}) {
  const { connection } = useConnection();
  const [result, setResult ] = useState<ResultType | null>(null);
  const { publicKey, sendTransaction } = useWallet();
  const [wager, setWager] = useState<number>(0);

  const anchorProgram = useRef(new anchor.Program(
    IDL,
    new PublicKey('bhgzNQvtLxejP1jsTYEpPQkZXQaiMWFawDCQ5J86bHh'),
    new anchor.AnchorProvider(
        connection,
        new NodeWallet(Keypair.fromSeed(new Uint8Array(32).fill(1))),
        {},
      ),
  )).current


  const gameId =  useMemo(() => publicKey ? PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode("game")),
      publicKey.toBuffer(),
    ],
    anchorProgram.programId
  )[0] : null, [publicKey, anchorProgram.programId]);

 async function requestGame(amount: number) {
  setWager(amount);
  if (publicKey && anchorProgram && gameId) {
    const [request] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("request_ticket")),
        publicKey.toBuffer(),
      ],
      anchorProgram.programId
    );

    const ix = await anchorProgram.methods
      .request(new anchor.BN(amount * LAMPORTS_PER_SOL))
      .accounts({
        player: publicKey,
        request,
        systemProgram: anchor.web3.SystemProgram.programId,
      }).instruction();

      const tx = new Transaction().add(ix)
    const sig = await sendTransaction(tx, connection, {skipPreflight: true});
    console.log(sig);
    const latestBlockHash = await connection.getLatestBlockhash();

    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: sig,
    });


    let gameAccount = null;

    while (!gameAccount) {
      try {
        gameAccount = await anchorProgram.account.game.fetch(gameId);
      } catch (e: any) {
        gameAccount = null
        await new Promise(res => setTimeout(res, 500))
      }
      console.log('gameAccount', gameAccount);
    }

    return amount;
  }
 }

 async function joinGame() {
  if (publicKey && anchorProgram && gameId) {

    const [gameAuthority, _gameAuthorityBump] =
      PublicKey.findProgramAddressSync(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode("authority")),
          gameId.toBuffer(),
        ],
        anchorProgram.programId
      );

    const userRandom = new anchor.BN(Math.floor(Math.random() * 10000));
    const ix = await anchorProgram.methods.join(userRandom)
    .accounts({
      player: publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      game: gameId,
      gameAuthority,
    }).instruction();

    const tx = new Transaction().add(ix)
    const sig = await sendTransaction(tx, connection, {skipPreflight: true});
    console.log(sig);
    const latestBlockHash = await connection.getLatestBlockhash();

    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: sig,
    });


    return gameId;
  }
 }

 async function submitGame(amount: number) {
  if (publicKey && anchorProgram && gameId) {
    const [request] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("request_ticket")),
        publicKey.toBuffer(),
      ],
      anchorProgram.programId
    );


    const [gameAuthority, _gameAuthorityBump] =
      PublicKey.findProgramAddressSync(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode("authority")),
          gameId.toBuffer(),
        ],
        anchorProgram.programId
      );

    const ix = await anchorProgram.methods.submit(new anchor.BN(amount)).accounts({
      creator: new PublicKey('fukWtWnqLwhikwMeLdqEhXdNKoXs6ArMP6g82RRZCnk'),
      player: publicKey,
      game: gameId,
      gameAuthority,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).instruction();

    console.log(ix);
    const tx = new Transaction().add(ix)
    const sig = await sendTransaction(tx, connection, {skipPreflight: true});
    const latestBlockHash = await connection.getLatestBlockhash();

    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: sig,
    });


    return gameId;
  }

 }

  const value = useMemo(
    () => ({
      gameId,
      wager,
      joinGame,
      submitGame,
      result,
      setResult,
      requestGame,
      anchorProgram
    }),
    [
      gameId,
      wager,
      result,
      setResult,
      joinGame,
      submitGame,
      requestGame,
      anchorProgram
    ],
  );

  return (
    <GameContext.Provider value={value}>
      {props.children}
    </GameContext.Provider>
  );
}

export const useGame = () => React.useContext(GameContext);

