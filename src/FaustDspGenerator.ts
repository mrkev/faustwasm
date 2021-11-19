import { FaustMonoAudioWorkletNode, FaustPolyAudioWorkletNode } from "./FaustAudioWorkletNode";
import getFaustAudioWorkletProcessor from "./FaustAudioWorkletProcessor";
import FaustDspInstance from "./FaustDspInstance";
import FaustWasmInstantiator from "./FaustWasmInstantiator";
import FaustOfflineProcessor, { IFaustOfflineProcessor } from "./FaustOfflineProcessor";
import { FaustMonoScriptProcessorNode, FaustPolyScriptProcessorNode } from "./FaustScriptProcessorNode";
import { FaustBaseWebAudioDsp, FaustMonoWebAudioDsp, FaustPolyWebAudioDsp, IFaustMonoWebAudioNode, IFaustPolyWebAudioNode } from "./FaustWebAudioDsp";
import type { IFaustCompiler } from "./FaustCompiler";
import type { FaustDspFactory, FaustDspMeta } from "./types";
import { FaustWebAudioDspVoice } from ".";

export interface IFaustMonoDspGenerator {

    /**
     * Compile a monophonic WebAudio node (either ScriptProcessorNode or AudioWorkletNode).
     * Note that an internal cache avoids recompilation when a same DSP program is recompiled several times.  
     * 
     * @param context the WebAudio context
     * @param name - the DSP name
     * @param compiler - the Faust compiler
     * @param code - the DSP code
     * @param args - the compilation parameters
     * @param sp - whether to compile a ScriptProcessorNode or an AudioWorkletNode
     * @param bufferSize - the buffer size in frames to be used, in ScriptProcessorNode only, since AudioWorkletNode always uses 128 frames   
     * @returns the compiled WebAudio node or 'null' if failure
     */
    compileNode(
        context: BaseAudioContext,
        name: string,
        compiler: IFaustCompiler,
        code: string,
        args: string,
        sp?: boolean,
        bufferSize?: number
    ): Promise<IFaustMonoWebAudioNode | null>;

    /**
     * Create a monophonic WebAudio node (either ScriptProcessorNode or AudioWorkletNode).
     *
     * @param context the WebAudio context
     * @param name - the DSP name
     * @param factory - the Faust factory, either obtained with a compiler (createDSPFactory) or loaded from files (loadDSPFactory)
     * @param sp - whether to compile a ScriptProcessorNode or an AudioWorkletNode
     * @param bufferSize - the buffer size in frames to be used in ScriptProcessorNode only, since AudioWorkletNode always uses 128 frames  
     * @returns the compiled WebAudio node or 'null' if failure
    */
    createNode(
        context: BaseAudioContext,
        name: string,
        factory: FaustDspFactory,
        sp?: boolean,
        bufferSize?: number
    ): Promise<IFaustMonoWebAudioNode | null>;

    /**
     * Return the internal factory.
     *
     * @returns the internal factory which can be null if compilation failed
     */
    getFactory(): FaustDspFactory | null;

    /**
    * Create a monophonic Offline processor.
    *
    * @param factory - the Faust factory, either obtained with a compiler (createDSPFactory) or loaded from files (loadDSPFactory)
    * @param sampleRate - the sample rate in Hz
    * @param bufferSize - the buffer size in frames   
    * @returns the compiled processor or 'null' if failure
    */
    createOfflineProcessor(factory: FaustDspFactory, sampleRate: number, bufferSize: number): Promise<IFaustOfflineProcessor | null>;
}

export interface IFaustPolyDspGenerator {
    /**
     * Compile a polyphonic WebAudio node from a single DSP file (either ScriptProcessorNode or AudioWorkletNode). 
     * Note that the an internal cache avoid recompilation when a same DSP program is recompiled several times.
     *
     * @param context the WebAudio context
     * @param name - the DSP name
     * @param compiler - the Faust compiler
     * @param code - the DSP code ('code' can possibly contain an integrated effect)
     * @param effectCode - optional effect DSP code
     * @param args - the compilation parameters
     * @param voices - the number of voices
     * @param sp - whether to compile a ScriptProcessorNode or an AudioWorkletNode
     * @param bufferSize - the buffer size in frames to be used, in ScriptProcessorNode only, since AudioWorkletNode always uses 128 frames
     * @returns the compiled WebAudio node or 'null' if failure
     */
    compileNode(
        context: BaseAudioContext,
        name: string,
        compiler: IFaustCompiler,
        code: string,
        effectCode: string | null,
        args: string,
        voices: number,
        sp?: boolean,
        bufferSize?: number
    ): Promise<IFaustPolyWebAudioNode | null>;

    /**
     * Create a polyphonic WebAudio node (either ScriptProcessorNode or AudioWorkletNode).
     *
     * @param context the WebAudio context
     * @param name - the DSP name
     * @param voiceFactory - the Faust factory for voices, either obtained with a compiler (createDSPFactory) or loaded from files (loadDSPFactory)
     * @param mixerModule - the wasm Mixer module (loaded from 'mixer32.wasm' or 'mixer64.wasm' files)
     * @param voices - the number of voices
     * @param sp - whether to compile a ScriptProcessorNode or an AudioWorkletNode
     * @param effectFactory - the Faust factory for the effect, either obtained with a compiler (createDSPFactory) or loaded from files (loadDSPFactory) 
     * @param bufferSize - the buffer size in frames to be used in ScriptProcessorNode only, since AudioWorkletNode always uses 128 frames
     * @returns the compiled WebAudio node or 'null' if failure
     */
    createNode(
        context: BaseAudioContext,
        name: string,
        voiceFactory: FaustDspFactory,
        mixerModule: WebAssembly.Module,
        voices: number,
        sp?: boolean,
        effectFactory?: FaustDspFactory,
        bufferSize?: number)
        : Promise<IFaustPolyWebAudioNode | null>;

    /**
     * Return the internal voice factory.
     *
     * @returns the internal factory which can be null if compilation failed
     */
    getVoiceFactory(): FaustDspFactory | null;

    /**
    * Return the internal effect factory.
    *
    * @returns the internal factory which can be null if compilation failed or if effect is not present
    */
    getEffectFactory(): FaustDspFactory | null;
}

export class FaustMonoDspGenerator implements IFaustMonoDspGenerator {
    fFactory: FaustDspFactory | null;

    // Set of all created WorkletProcessors, each of them has to be unique
    private static gWorkletProcessors: Set<string> = new Set();

    constructor() {
        this.fFactory = null;
    }

    async compileNode(context: BaseAudioContext, name: string, compiler: IFaustCompiler, code: string, args: string, sp?: boolean, bufferSize?: number) {
        this.fFactory = await compiler.createMonoDSPFactory(name, code, args);
        return this.fFactory ? this.createNode(context, name, this.fFactory, sp, bufferSize) : null;
    }
    async createNode(context: BaseAudioContext, nameIn: string, factory: FaustDspFactory, sp = false, bufferSize = 1024) {
        const JSONObj: FaustDspMeta = JSON.parse(factory.json);
        const sampleSize = JSONObj.compile_options.match("-double") ? 8 : 4;
        if (sp) {
            const instance = await FaustWasmInstantiator.createAsyncMonoDSPInstance(factory);
            const monoDsp = new FaustMonoWebAudioDsp(instance, context.sampleRate, sampleSize, bufferSize);
            const sp = context.createScriptProcessor(bufferSize, monoDsp.getNumInputs(), monoDsp.getNumOutputs()) as FaustMonoScriptProcessorNode;
            Object.setPrototypeOf(sp, FaustMonoScriptProcessorNode.prototype);
            sp.init(monoDsp);
            return sp;
        } else {
            const name = nameIn + factory.cfactory.toString();
            // Dynamically create AudioWorkletProcessor if code not yet created
            if (!FaustMonoDspGenerator.gWorkletProcessors.has(name)) {
                try {
                    const processorCode = `
// DSP name and JSON string for DSP are generated
const faustData = {
    dspName: ${JSON.stringify(name)},
    dspMeta: ${factory.json}
};
// Implementation needed classes of functions
const ${FaustDspInstance.name}_default = ${FaustDspInstance.toString()}
const ${FaustBaseWebAudioDsp.name} = ${FaustBaseWebAudioDsp.toString()}
const ${FaustMonoWebAudioDsp.name} = ${FaustMonoWebAudioDsp.toString()}
const ${FaustWasmInstantiator.name} = ${FaustWasmInstantiator.toString()}
// Put them in dependencies
const dependencies = {
    ${FaustBaseWebAudioDsp.name},
    ${FaustMonoWebAudioDsp.name},
    ${FaustWasmInstantiator.name}
};
// Generate the actual AudioWorkletProcessor code
(${getFaustAudioWorkletProcessor.toString()})(dependencies, faustData);
`;
                    const url = URL.createObjectURL(new Blob([processorCode], { type: "text/javascript" }));
                    await context.audioWorklet.addModule(url);
                    // Keep the DSP name
                    FaustMonoDspGenerator.gWorkletProcessors.add(name);
                } catch (e) {
                    console.error(`=> exception raised while running createMonoNode: ${e}`);
                    console.error(`=> check that your page is served using https.${e}`);
                    return null;
                }
            }
            // Create the AWN
            return new FaustMonoAudioWorkletNode(context, name, factory, sampleSize);
        }
    }
    getFactory() {
        return this.fFactory;
    }
    async createOfflineProcessor(factory: FaustDspFactory, sampleRate: number, bufferSize: number): Promise<IFaustOfflineProcessor | null> {
        const instance = await FaustWasmInstantiator.createAsyncMonoDSPInstance(factory);
        const JSONObj: FaustDspMeta = JSON.parse(factory.json);
        const sampleSize = JSONObj.compile_options.match("-double") ? 8 : 4;
        const monoDsp = new FaustMonoWebAudioDsp(instance, sampleRate, sampleSize, bufferSize);
        return new FaustOfflineProcessor(monoDsp, bufferSize);
    }
}

export class FaustPolyDspGenerator implements IFaustPolyDspGenerator {
    fVoiceFactory: FaustDspFactory | null;
    fEffectFactory: FaustDspFactory | null;

    // Set of all created WorkletProcessors, each of them has to be unique
    private static gWorkletProcessors: Set<string> = new Set();

    constructor() {
        this.fVoiceFactory = null;
        this.fEffectFactory = null;
    }

    async compileNode(
        context: BaseAudioContext,
        name: string,
        compiler: IFaustCompiler,
        dspCode: string,
        effectCode: string,
        args: string,
        voices: number,
        sp?: boolean,
        bufferSize?: number
    ) {
        const voiceDsp = dspCode;
        const effect_dsp = effectCode || `
adapt(1,1) = _; adapt(2,2) = _,_; adapt(1,2) = _ <: _,_; adapt(2,1) = _,_ :> _;
adaptor(F,G) = adapt(outputs(F),inputs(G));
dsp_code = environment{${dspCode}};
process = adaptor(dsp_code.process, dsp_code.effect) : dsp_code.effect;`;
        // Compile voice
        const voiceFactory = await compiler.createPolyDSPFactory(name, voiceDsp, args);
        if (!voiceFactory) return null;
        // Compile effect, possibly failing since 'compilePolyNode2' can be called by called by 'compilePolyNode'
        const effectFactory = await compiler.createPolyDSPFactory(name, effect_dsp, args);
        // Compile mixer
        const JSONObj: FaustDspMeta = JSON.parse(voiceFactory.json);
        const isDouble = JSONObj.compile_options.match("-double");
        const mixerModule = await compiler.getAsyncInternalMixerModule(!!isDouble);
        return mixerModule ? this.createNode(context, name, voiceFactory, mixerModule, voices, sp, effectFactory || undefined, bufferSize) : null;
    }
    async createNode(
        context: BaseAudioContext,
        nameIn: string,
        voiceFactory: FaustDspFactory,
        mixerModule: WebAssembly.Module,
        voices: number,
        sp = false,
        effectFactory?: FaustDspFactory,
        bufferSize = 1024
    ) {
        const JSONObj: FaustDspMeta = JSON.parse(voiceFactory.json);
        const sampleSize = JSONObj.compile_options.match("-double") ? 8 : 4;
        if (sp) {
            const instance = await FaustWasmInstantiator.createAsyncPolyDSPInstance(voiceFactory, mixerModule, voices, effectFactory);
            const polyDsp = new FaustPolyWebAudioDsp(instance, context.sampleRate, sampleSize, bufferSize);
            const sp = context.createScriptProcessor(bufferSize, polyDsp.getNumInputs(), polyDsp.getNumOutputs()) as FaustPolyScriptProcessorNode;
            Object.setPrototypeOf(sp, FaustPolyScriptProcessorNode.prototype);
            sp.init(polyDsp);
            return sp;
        } else {
            const name = nameIn + voiceFactory.cfactory.toString() + "_poly";
            // Dynamically create AudioWorkletProcessor if code not yet created
            if (!FaustPolyDspGenerator.gWorkletProcessors.has(name)) {
                try {
                    const processorCode = `
// DSP name and JSON string for DSP are generated
const faustData = {
    dspName: ${JSON.stringify(name)},
    dspMeta: ${voiceFactory.json},
    effectMeta: ${effectFactory ? effectFactory.json : undefined}
};
// Implementation needed classes of functions
const ${FaustDspInstance.name}_default = ${FaustDspInstance.toString()}
const ${FaustBaseWebAudioDsp.name} = ${FaustBaseWebAudioDsp.toString()}
const ${FaustPolyWebAudioDsp.name} = ${FaustPolyWebAudioDsp.toString()}
const ${FaustWebAudioDspVoice.name} = ${FaustWebAudioDspVoice.toString()}
const ${FaustWasmInstantiator.name} = ${FaustWasmInstantiator.toString()}
// Put them in dependencies
const dependencies = {
    ${FaustBaseWebAudioDsp.name},
    ${FaustPolyWebAudioDsp.name},
    ${FaustWasmInstantiator.name}
};
// Generate the actual AudioWorkletProcessor code
(${getFaustAudioWorkletProcessor.toString()})(dependencies, faustData);
`;
                    const url = URL.createObjectURL(new Blob([processorCode], { type: "text/javascript" }));
                    await context.audioWorklet.addModule(url);
                    // Keep the DSP name
                    FaustPolyDspGenerator.gWorkletProcessors.add(name);
                } catch (e) {
                    console.error(`=> exception raised while running createMonoNode: ${e}`);
                    console.error(`=> check that your page is served using https.${e}`);
                    return null;
                }
            }
            // Create the AWN
            return new FaustPolyAudioWorkletNode(context, name, voiceFactory, mixerModule, voices, sampleSize, effectFactory);
        }
    }
    getVoiceFactory(): FaustDspFactory | null {
        return this.fVoiceFactory;
    }
    getEffectFactory(): FaustDspFactory | null {
        return this.fEffectFactory;
    }
}
