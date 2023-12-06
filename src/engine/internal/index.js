import { EngineValidator } from './validator.js';
import { Engine } from './engine.js';



export function createEngine(schema) {
    const validator = new EngineValidator(schema);    
    const engine = new Engine(validator);

    return engine;
};

