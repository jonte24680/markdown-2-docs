import { google, docs_v1, Auth, Common } from "googleapis";
import * as mdHelper from "./mdHelper";

export function markdownToGoogleDocsReq(markdown: string): docs_v1.Schema$Request[]{	

	function paragrafFlush(){
		if(paragrafText === ""){
			return;
		}
		// TODO: impliment paragraf to document
	}

	var req = new Array<docs_v1.Schema$Request>();
	const docsLength = markdown.length;
	let pointer = 0;
	let startLine = 0;
	let paragrafText = "";
	// let boldStart = -1;
	// let italicStart = -1;
	// let titleStart = -1;
	// let titleType = 0;


	/*
	TODO: ✅🚧 

    ✅Thematic breaks
    ✅ATX headings
    ✅Setext headings
    ✅Indented code blocks
    ✅Fenced code blocks
    🚫HTML blocks
    Link reference definitions
    ✅Paragraphs

    ✅Block quotes
    ✅List items
    ✅Lists
	
    Code spans
    Emphasis and strong emphasis
    Links
    Images
    Autolinks
    🚫Raw HTML
    Hard line breaks
    Soft line breaks
    Textual content

	*/
	while (true){
		const uslessSpaces = isEmptyLine(markdown, pointer);
		if(uslessSpaces === 0){
			break;
		}
		pointer += uslessSpaces;
	}

	while (pointer < docsLength){
		const arg = new BlockArg(markdown, pointer, paragrafText);

		const setext = setextHeading(arg); // FIXME: scoud no happe when its a list
		if(setext !== null){
			
			continue;
		}

		const thematic = thematicBreak(arg); 
		if(thematic !== null){
			
			continue;
		}

		const bullet = bulletList(arg);
		if(bullet !== null){
			
			continue;
		}

		const ordered = orderedList(arg);
		if(ordered !== null){
			
			continue;
		}

		const indented = indentedCodeBlock(arg);
		if(indented !== null){
			
			continue;
		}

		const quote = blockQuote(arg, arg.markdown, arg.pointer, 0);
		if(quote !== null){
			
			continue;
		}

		const fenced = fencedCodeBlock(arg);
		if(fenced !== null){
			
			continue;
		}

		const atx = atxHeading(arg);
		if(atx !== null){
			
			continue;
		}
			
		if(paragrafText !== ""){
			paragrafText += " ";
		}
		paragrafText += getTextInLine(markdown, pointer).trim();
		pointer = nextLine(markdown, pointer);

		// var newLines = isNewLineChar();
		// if(0 > newLines){
		// 	//add new line
		// 	pointer += newLines;
		// 	startLine = pointer;
		// }
	}

	req.push({
		insertText: {
			endOfSegmentLocation: {},
			text: markdown
		}
	});
	return req;
}

class BlockArg {
	constructor(markdown: string, pointer: number, paragraphBefore: string){
		this._markdown = markdown;
		this._pointer = pointer;
		this._paragraphBefore = paragraphBefore;
	}

	private _markdown: string;
	get markdown (){
		return this._markdown;
	};

	private _pointer: number;
	get pointer (){
		return this._pointer;
	};

	private _paragraphBefore: string;
	get paragraphBefore (){
		return this._paragraphBefore;
	};
}

class BlockReturn {
	request: docs_v1.Schema$Request[] = new Array<docs_v1.Schema$Request>();
	nextPointer: number = -1;
}

function thematicBreak({ markdown, pointer}: BlockArg): null | BlockReturn {
	const spaces = spacesLength(markdown, pointer);
	if(3 < spaces.totalSpace()){
		return null;
	}
	
	let chars = [
		charRepeatLenght(markdown, pointer + spaces.indexDelta(), "*", true),
		charRepeatLenght(markdown, pointer + spaces.indexDelta(), "-", true),
		charRepeatLenght(markdown, pointer + spaces.indexDelta(), "_", true)
	];

	chars.sort((a , b) => b.chars - a.chars);
	if(chars[0].chars < 3){
		return null;
	}

	const indexDelta = spaces.indexDelta() + chars[0].indexDelta();
	if(isNewLineChar(markdown, pointer + indexDelta) !== 0 || markdown.length <= pointer + indexDelta){
		//TODO: add thematic breaks to document 
		const ret = new BlockReturn();
		return ret;
	}
	return null;
}

function atxHeading({ markdown, pointer}: BlockArg): null | BlockReturn {
	const spaces = spacesLength(markdown, pointer);
	if(3 < spaces.totalSpace()){
		return null;
	}

	let indexDelta = spaces.indexDelta();
	// pointer += spaces.indexDelta();
	const titleHashtags = charRepeatLenght(markdown, pointer + indexDelta, "#");
	if(0 === titleHashtags.chars || 6 < titleHashtags.chars){
		return null;
	}
	indexDelta += titleHashtags.chars;

	const afterSpaces = spacesLength(markdown, pointer + indexDelta);
	if(afterSpaces.indexDelta() === 0 && isNewLineChar(markdown, pointer + indexDelta) !== 0){
		return null;
	}
	indexDelta += afterSpaces.indexDelta();

	let text = getTextInLine(markdown, pointer).slice(pointer + indexDelta);
	text = text.trimEnd();

	let i = text.length - 1;
	let hashTagRemove = 0;
	while (0 <= i){
		if(text[i] === "#"){
			hashTagRemove++;
			i--;
			continue;
		}
		if(text[i] === "\\" && hashTagRemove !== 0){
			hashTagRemove = 0;
			//break;
		}
		if(text[i] !== " " && text[i] !== "\t"){
			hashTagRemove = 0;
		}
		break;
	}
	text.slice(0, text.length - hashTagRemove).trimEnd();

	// TODO: add title to document
	const ret = new BlockReturn();
	return ret;

}

function setextHeading({ markdown, pointer, paragraphBefore }: BlockArg): null | BlockReturn {
	if(paragraphBefore === ""){
		return null;
	}

	const spaces = spacesLength(markdown, pointer);
	if(3 < spaces.totalSpace()){
		return null;
	}
	pointer += spaces.indexDelta();

	const equelTitle = charRepeatLenght(markdown, pointer, "=");
	if(equelTitle.chars !== 0 && isEmptyLine(markdown, pointer + equelTitle.indexDelta()) !== 0){
		// TODO: inpliment h1 titel
		const ret = new BlockReturn();
		return ret;
	}

	const hyphenTitle = charRepeatLenght(markdown, pointer, "=");
	if(hyphenTitle.chars !== 0 && isEmptyLine(markdown, pointer + hyphenTitle.indexDelta()) !== 0){
		// TODO: inpliment h2 titel
		const ret = new BlockReturn();
		return ret;
	}

	return null;
}

function indentedCodeBlock({ markdown, pointer, paragraphBefore }: BlockArg): null | BlockReturn {
	if(paragraphBefore !== ""){
		return null;
	}

	const spaces = spacesLength(markdown, pointer);
	if(spaces.totalSpace() < 4){
		return null;
	}

	if(false){// FIXME: not a list
		return null;
	}

	let text = getTextInLine(markdown, pointer);
	text = mdHelper.IndentedCodeBlock.whitespaceRemove(text);

	let i = pointer;
	while(i < markdown.length){
		i = nextLine(markdown, i);

		if( isEmptyLine(markdown, i) !== 0){
			text += "/n";

			continue;
		}

		const spaces = spacesLength(markdown, i);
		if(spaces.totalSpace() < 4 ) {
			break;
		}

		let newText = getTextInLine(markdown, i);
		text += "/n" + mdHelper.IndentedCodeBlock.whitespaceRemove(newText);

		continue;
	}
	text = text.trim();
	pointer = nextLine(markdown, i);
	// TODO: add indented codeblock to document;

	const ret = new BlockReturn();
	return ret;
}

function fencedCodeBlock({ markdown, pointer }: BlockArg): null | BlockReturn {
	const markerSpaces = spacesLength(markdown, pointer);
	if(3 < markerSpaces.totalSpace()) {
		return null;
	}
	pointer += markerSpaces.indexDelta();
	
	let chars = [
		{
			char: "`",
			repeat: charRepeatLenght(markdown, pointer, "`")
		},
		{
			char: "~",
			repeat: charRepeatLenght(markdown, pointer, "~")
		}
	];
	chars.sort((a, b) => b.repeat.chars - a.repeat.chars);

	if(chars[0].repeat.chars < 3){
		return null;
	}
	// fenced codeblock
	// const fencedCodeblock = {
	// 	char: "",
	// 	amount: 0,
	// 	spaces: 0
	// };
	// const repetedBacksticks = charRepeatLenght(markdown, pointer, "`");
	// if(3 <= repetedBacksticks.chars){
	// 	fencedCodeblock.char = "`";
	// 	fencedCodeblock.amount = repetedBacksticks.chars;
	// 	fencedCodeblock.spaces = spaces.totalSpace();
	// }
	// const repetedTildes = charRepeatLenght(markdown, pointer, "~");
	// if(3 <= repetedTildes.chars){
	// 	fencedCodeblock.char = "~";
	// 	fencedCodeblock.amount = repetedTildes.chars;
	// 	fencedCodeblock.spaces = spaces.totalSpace();
	// }
	let text = "";
	let i = pointer;
	while (i < markdown.length){
		const spaces = spacesLength(markdown, i);
		
		//end cheker
		if(spaces.totalSpace() <= 3){
			const repeatEndChar = charRepeatLenght(markdown, i + spaces.indexDelta(), chars[0].char); 
			if(chars[0].repeat.chars <= repeatEndChar.chars && isEmptyLine(markdown, i + spaces.indexDelta() + repeatEndChar.chars) !== 0){
				break;
			}
		}

		let skipSpace: number = spaces.indexDelta() <= markerSpaces.spaces ? spaces.indexDelta() : markerSpaces.spaces;
		text += getTextInLine(markdown, i).slice(skipSpace) + "\n";
		i = nextLine(markdown, i);
	}
	if(text[text.length -1 ] === "\n"){
		text = text.slice(0, text.length - 1);
	}
	pointer = nextLine(markdown, i); // next line

	// TODO: add fenced codeblock to document

	const ret = new BlockReturn();
	return ret;
}

function htmlBlock({ markdown, pointer, paragraphBefore }: BlockArg): null | BlockReturn {
	return null;
	const ret = new BlockReturn();
	return ret;
}

function linkReferenceDefinition({ markdown, pointer, paragraphBefore }: BlockArg): null | BlockReturn {
	
	const ret = new BlockReturn();
	return ret;
	return null;
}

function paragraph({ markdown, pointer, paragraphBefore }: BlockArg): null | BlockReturn {
	
	const ret = new BlockReturn();
	return ret;
	return null;
}

function isParagraph({ markdown, pointer, paragraphBefore }: BlockArg): boolean {
	const arg = new BlockArg(markdown, pointer, paragraphBefore);
	const blocks = [
		setextHeading(arg),
		thematicBreak(arg), 
		bulletList(arg),
		orderedList(arg),
		indentedCodeBlock(arg),
		blockQuote(arg, markdown, pointer, 0),
		fencedCodeBlock(arg),
		atxHeading(arg)
	];
	return blocks.every(x => x === null);
}

function blockQuote({ markdown, pointer }: BlockArg, rawMarkdown: string, rawPointer: number, indentation: number): null | BlockReturn {
	const spaces = spacesLength(markdown, pointer);
	if(3 < spaces.totalSpace()){
		return null;
	}
	
	if(markdown[pointer + spaces.indexDelta()] !== ">"){
		return null;
	}
	
	const ret = new BlockReturn();
	let paragrafText = "";
	while(true){
		const rawArg = new BlockArg(rawMarkdown, rawPointer, "");
		if(isBlockQuotesIndentation(rawArg, indentation)){
			const text = makeBlockQuoteRequest(rawArg, indentation);
			let index = 0;
			while(index < text.length){
				const arg = new BlockArg(text, index, paragrafText);
		
				const setext = setextHeading(arg); // FIXME: scoud no happe when its a list
				if(setext !== null){
					
					continue;
				}
				const thematic = thematicBreak(arg); 
				if(thematic !== null){
					
					continue;
				}
				const bullet = bulletList(arg);
				if(bullet !== null){
					
					continue;
				}
				const ordered = orderedList(arg);
				if(ordered !== null){
					
					continue;
				}
				const indented = indentedCodeBlock(arg);
				if(indented !== null){
					
					continue;
				}
				const quote = blockQuote(arg, rawMarkdown, rawPointer, indentation + 1);
				if(quote !== null){
					
					continue;
				}
				const fenced = fencedCodeBlock(arg);
				if(fenced !== null){
					
					continue;
				}
				const atx = atxHeading(arg);
				if(atx !== null){
					
					continue;
				}

				if(paragrafText !== ""){
					paragrafText += " ";
				}
				paragrafText += getTextInLine(markdown, pointer).trim();
				pointer = nextLine(markdown, pointer);
				rawPointer = nextLine(rawMarkdown, rawPointer);
			}
			continue;
		}
		if(paragrafText !== ""){
			let remove = 0;
			for (let i = indentation; 0 <= i; i--){
				remove = blockQuotesCharRemove(rawArg, i);
				if(remove !== 0){
					break;
				}
			}

			const tArg = new BlockArg(getTextInLine(rawMarkdown, rawPointer).slice(remove), 0, "");
			const isParagraph = [
				thematicBreak(tArg), 
				bulletList(tArg),
				orderedList(tArg),
				indentedCodeBlock(tArg),
				fencedCodeBlock(tArg),
				atxHeading(tArg)
			].every(x => x === null);

			if(isParagraph){
				if(paragrafText !== ""){
					paragrafText += " ";
				}
				paragrafText += getTextInLine(markdown, pointer).trim();
				pointer = nextLine(markdown, pointer);
				rawPointer = nextLine(rawMarkdown, rawPointer);
				continue;
			}
		}
		break;
	}
	if(paragrafText !== ""){
		// paragraf text
	}

	//markdownToGoogleDocsReq(innerText);
	// TODO: impliment block quotes

	return ret;
}

function isBlockQuotesIndentation(blockArg:  BlockArg, quotes: number){
	return blockQuotesCharRemove(blockArg, quotes);
}

function blockQuotesCharRemove({ markdown, pointer }: BlockArg, quotes: number) {
	let remove = 0;
	for (let i = 0; i < quotes + 1; i++){
		const spaces = spacesLength(markdown, pointer + remove);
		if(3 < spaces.totalSpace()){
			return 0;
		}

		if(markdown[pointer + spaces.indexDelta()] !== ">"){
			return 0;
		}
		remove = spaces.indexDelta() + 1;
		if(markdown[pointer + remove] === " "){ // TODO: mayby tabs 
			remove += 1;
		}
	}
	return remove;
}

function makeBlockQuoteRequest({ markdown, pointer }: BlockArg, quotes: number){
	let text = "";
	while(pointer < markdown.length){
		let remove = blockQuotesCharRemove(new BlockArg(markdown, pointer, ""), quotes);
		if(remove === 0){
			return text;
		}

		text += getTextInLine(markdown, pointer).slice(remove) + "\n";
		pointer = nextLine(markdown, pointer);
	}
	return text;
}

function bulletList({ markdown, pointer, paragraphBefore }: BlockArg): null | BlockReturn {
	const spaces = spacesLength(markdown, pointer);
	// Bulletin list
	const bulletListMarker = ["+", "-", "*"].find(x => markdown[pointer + spaces.indexDelta()]);
	if(bulletListMarker !== undefined && spaces.totalSpace() < 4){
		let indentation = spaces.indexDelta() + 1;
		const afterSpaces = spacesLength(markdown, pointer + indentation);

		if(afterSpaces.indexDelta() !== 0 || isEmptyLine(markdown, pointer + indentation) !== 0){ // FIXME: questenebel
			indentation += 1;
			if(afterSpaces.totalSpace() <= 5){
				indentation += afterSpaces.indexDelta() - 1;
			}

			let text = getTextInLine(markdown, pointer).slice(indentation) + "\n";
			let index = pointer;
			while (true){
				index = nextLine(markdown, index);
				if(isEmptyLine(markdown, index) !== 0){
					text += "\n";
					continue;
				}

				const spaces = spacesLength(markdown, index);
				if(spaces.totalSpace() >= indentation){
					text += getTextInLine(markdown, index).slice(indentation) + "\n";
					continue;
				}
				break;
			}
			pointer = nextLine(markdown, index); //next pointer
			// TODO: add bullet list in document;
			//continue;
		}
	}
	const ret = new BlockReturn();
	return ret;
	return null;
}

function orderedList({ markdown, pointer, paragraphBefore }: BlockArg): null | BlockReturn {
	const spaces = spacesLength(markdown, pointer);
	// orded list
	const ordetRegex = new RegExp(/[1-9]{1,9}[\.\)]{1}/);
	const text = getTextInLine(markdown, pointer);
	const orded = ordetRegex.exec(text);
	if(orded !== null && text.indexOf(orded[0]) === spaces.indexDelta() && spaces.totalSpace() < 4){
		const ordedChar = orded[0][orded[0].length - 1];
		let indentation = spaces.indexDelta() + 1;
		const afterSpaces = spacesLength(markdown, pointer + indentation);

		if(afterSpaces.indexDelta() !== 0 || isEmptyLine(markdown, pointer + indentation) !== 0){
			indentation += 1;
			if(afterSpaces.totalSpace() <= 5){
				indentation += afterSpaces.indexDelta() - 1;
			}

			let text = getTextInLine(markdown, pointer).slice(indentation) + "\n";
			let index = pointer;
			while (true){
				index = nextLine(markdown, index);
				if(isEmptyLine(markdown, index) !== 0){
					text += "\n";
					continue;
				}

				const spaces = spacesLength(markdown, index);
				if(spaces.totalSpace() >= indentation){
					text += getTextInLine(markdown, index).slice(indentation) + "\n";
					continue;
				}
				break;
			}
			pointer = nextLine(markdown, index);
			// TODO: add orded list in document;
			//continue;
		}
	}
	const ret = new BlockReturn();
	return ret;
	return null;
}

function inlineText(text: string, indentation: number, headerType : number): docs_v1.Schema$Request[]{
	// https://googleapis.dev/nodejs/googleapis/latest/docs/interfaces/Schema$InsertTextRequest.html 

	//if()
	const ret = new Array<docs_v1.Schema$Request>();
	var paragrafStyle = inlineParagrafStyle(indentation, headerType);

	var insertText: docs_v1.Schema$InsertTextRequest = {
		text: text,
		location: {
			index: 0
		}
	};

	paragrafStyle.range = {
		startIndex: 0,
		endIndex: text.length
	};

	ret.push({updateParagraphStyle: paragrafStyle}, {insertText: insertText});

	return ret;

	/*
	if(false) { // autolink

	}
	if(false) { // code span

	}

	return ret;
	*/
}

function inlineParagrafStyle(indentation: number, heading : number){
	const ret: docs_v1.Schema$UpdateParagraphStyleRequest = {
		fields: "namedStyleType indentStart",
		paragraphStyle: {
			indentStart: {
				magnitude: indentation,
				unit: "PT"
			},
			namedStyleType: "NORMAL_TEXT",
		},
	};
	if(ret.paragraphStyle === undefined){ // maked TS happy. never going to happen.
		return ret;
	}
		/* 
		"NORMAL_TEXT"
		"HEADING_1"
		"HEADING_2"
		"HEADING_3"
		"HEADING_4"
		"HEADING_5"
		"HEADING_6"
		"TITLE"
		"SUBTITLE"
	*/
	if(heading === 1){
		ret.paragraphStyle.namedStyleType = "TITLE";
	}
	if(heading > 1){
		ret.paragraphStyle.namedStyleType = "HEADING_" + (heading - 1);
	}
	return ret;
}

//   _    _      _                     
//  | |  | |    | |                    
//  | |__| | ___| |_ __   ___ _ __ ___ 
//  |  __  |/ _ \ | '_ \ / _ \ '__/ __|
//  | |  | |  __/ | |_) |  __/ |  \__ \
//  |_|  |_|\___|_| .__/ \___|_|  |___/
//                | |                  
//                |_|                  

function isNewLineChar(markdown: string, index: number){
	if(markdown[index] === "\r" && markdown[index + 1] === "\n"){
		return 2;
	}
	if (markdown[index] === "\n" || markdown[index] === "\r") {
		return 1;
	}
	return 0;
}

function isEmptyLine(markdown: string, index: number){ // TODO: make invalid return -1
	const length = spacesLength(markdown, index).indexDelta();
	const endCharacters = isNewLineChar(markdown, index + length);
	if(endCharacters === 0){
		return 0; //
	}
	return length + endCharacters;
}

function charRepeatLenght(markdown: string, startIndex: number, char: string, ignoreSpces: boolean = false){
	const ret = { 
		chars: 0, 
		spaces: 0, 
		tabs: 0, 
		totalSpace: () => ret.tabs * 4 + ret.spaces, 
		indexDelta: () => ret.chars + ret.spaces + ret.tabs
	};
	while(true){
		const currentIndex = startIndex + ret.indexDelta();
		if (currentIndex === markdown.length){
			return ret;
		}

		if(markdown[currentIndex] === char){
			ret.chars++;
		} else if (ignoreSpces && markdown[currentIndex] === " "){
			ret.spaces++;
		} else if (ignoreSpces && markdown[currentIndex] === "\t"){
			ret.tabs++;
		} else {
			return ret;
		}
	}
}

function spacesLength(markdown: string, startIndex: number){
	return charRepeatLenght(markdown, startIndex, "", true);
}

function nextLine(markdown: string, index: number){
	while(index < markdown.length){
		const lines = isNewLineChar(markdown, index);
		if(lines !== 0){
			return index + lines;
		}
		index++;
	}
	return -1;
}

function lineStart(markdown: string, index: number){
	while(0 < index){
		if(isNewLineChar(markdown, index - 1) === 1){
			return index;
		}
		index--;
	}
	return 0;
}

//	function previusLinePoint(startIndex: number = pointer){
//		while(startIndex > 0){
//
//		}
//		return -1
//	}

function getTextInLine(markdown: string, index: number){
	index = lineStart(markdown, index);
	var offset = 0;
	while(index + offset < markdown.length){
		if(isNewLineChar(markdown, index + offset) !== 0){
			break;
		}
		offset++;
	}
	return markdown.slice(index, index + offset);
}

function nextEnterSeperator(markdown: string, startIndex: number){ // TODO: is this function needed.
	while(startIndex < markdown.length){
		const lines = isNewLineChar(markdown, startIndex);
		if(lines !== 0 && startIndex + lines < markdown.length){
			startIndex += lines;
			const repete = spacesLength(markdown, startIndex);
			if(startIndex + repete.spaces < markdown.length){
				startIndex += repete.spaces;
			}
			
		}
		startIndex++;
	}
	return startIndex--;
}

function charOwnLineInSection(markdown: string, startIndex: number, repChar : string, minRepAmount : number = 3){
	const lastIndex = nextEnterSeperator(markdown, startIndex);
	while (startIndex <= lastIndex){
		const spaces = spacesLength(markdown, startIndex);
		startIndex += spaces.indexDelta();
		if(spaces.totalSpace() <= 3){
			const charRepet = charRepeatLenght(markdown, startIndex, repChar, false);
			startIndex += charRepet.chars;
			if(charRepet.chars <= minRepAmount){
				const extraSpace = spacesLength(markdown, startIndex);
				startIndex += extraSpace.indexDelta();
				if(isNewLineChar(markdown, startIndex)){
					return {ret: true, amount: charRepet.chars, nextLine: startIndex + isNewLineChar(markdown, startIndex)};
				}
			}
		}
	}
	return {ret: false, amount: 0, nextLine: lastIndex};
}