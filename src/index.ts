import instantiateLibFaust from "./instantiateLibFaust";
import getFaustAudioWorkletProcessor from "./FaustAudioWorkletProcessor";
import FaustCompiler from "./FaustCompiler";
import FaustDspInstance from "./FaustDspInstance";
import FaustWasmInstantiator from "./FaustWasmInstantiator";
import FaustOfflineProcessor from "./FaustOfflineProcessor";
import FaustSvgDiagrams from "./FaustSvgDiagrams";
import LibFaust from "./LibFaust";
import WavEncoder from "./WavEncoder";
import WavDecoder from "./WavDecoder";

export * from "./FaustAudioWorkletNode";
export * from "./FaustAudioWorkletProcessor";
export * from "./FaustCompiler";
export * from "./FaustDspInstance";
export * from "./FaustOfflineProcessor";
export * from "./FaustScriptProcessorNode";
export * from "./FaustWebAudioDsp";
export * from "./FaustDspGenerator";
export * from "./LibFaust";


export {
    instantiateLibFaust,
    getFaustAudioWorkletProcessor,
    FaustDspInstance,
    FaustCompiler,
    FaustWasmInstantiator,
    FaustOfflineProcessor,
    FaustSvgDiagrams,
    LibFaust,
    WavEncoder,
    WavDecoder,
};

export default {
    instantiateLibFaust,
    getFaustAudioWorkletProcessor,
    FaustDspInstance,
    FaustCompiler,
    FaustWasmInstantiator,
    FaustOfflineProcessor,
    FaustSvgDiagrams,
    LibFaust,
    WavEncoder,
    WavDecoder,
};
