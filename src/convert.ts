import { sync } from "glob";
import { google, docs_v1, Auth, Common } from "googleapis";
import * as mdHelper from "./mdHelper";

class BlockArg {
	constructor(markdown: string, pointer: number, paragraphBefore: string, reqIndex: number, indented: number){
		this.markdown = markdown;
		this.pointer = pointer;
		this.paragraphBefore = paragraphBefore;
		this.reqIndex = reqIndex;
		this.indented = indented;
	}

	readonly markdown: string;
	readonly pointer: number;
	readonly paragraphBefore: string;
	readonly reqIndex: number;
	readonly indented: number;
}

class BlockReturn {
	request: docs_v1.Schema$Request[] = new Array<docs_v1.Schema$Request>();
	nextPointer: number = -1;
}

class ContainerBlockReturn extends BlockReturn {
	links: LinkRefrence[] = new Array<LinkRefrence>();
}

class LinkRefrence{
	constructor(name: string, url: string, title: string){
		this.name = name;
		this.url = url;
		this.title = title;
	}
	readonly name: string;
	readonly url: string;
	readonly title: string;
}

export function markdownToGoogleDocsReq(markdown: string): docs_v1.Schema$Request[]{	
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

	const convert = convertMarkdown(markdown, 0, "");
	if(convert.extraText !== ""){
		convert.requests = convert.requests.concat(paragrafFlush(convert.extraText, convert.lastRequestIndex));
	}


	return convert.requests;
}

function convertMarkdown(markdown: string, indented: number, paragragBefore: string){
	var req = new Array<docs_v1.Schema$Request>();
	var linkReferences = new Array<LinkRefrence>();
	let pointer = 0;
	let requestIndex = 1;
	let paragrafText = paragragBefore;

	while (pointer < markdown.length){
		if(pointer === -1){
			throw new Error(`Pointer is set to -1.  req.length ${req.length}. indented ${indented}`);
		}

		if(pointer !== 0){
			requestIndex = getLastRequestIndex(req);
		}
		const arg = new BlockArg(markdown, pointer, paragrafText, requestIndex, indented);

		const setext = setextHeading(arg); // FIXME: scoud no happe when its a list
		if(setext !== null){
			paragrafText = "";
			req = req.concat(setext.request);
			pointer = setext.nextPointer;
			continue;
		}

		const thematic = thematicBreak(arg); 
		if(thematic !== null){
			const paraFlush = paragrafFlush(paragrafText, requestIndex);
			req = req.concat(paraFlush);
			paragrafText = "";

			req = req.concat(addRequestIndex(thematic.request, paraFlush, requestIndex));
			pointer = thematic.nextPointer;
			continue;
		}

		const bullet = bulletList(arg);
		if(bullet !== null){
			const paraFlush = paragrafFlush(paragrafText, requestIndex);
			req = req.concat(paraFlush);
			paragrafText = "";

			req = req.concat(addRequestIndex(bullet.request, paraFlush, requestIndex));
			linkReferences = linkReferences.concat(bullet.links);
			pointer = bullet.nextPointer; 
			continue;
		}

		const ordered = orderedList(arg);
		if(ordered !== null){
			const paraFlush = paragrafFlush(paragrafText, requestIndex);
			req = req.concat(paraFlush);
			paragrafText = "";

			req = req.concat(addRequestIndex(ordered.request, paraFlush, requestIndex));
			linkReferences = linkReferences.concat(ordered.links);
			pointer = ordered.nextPointer;
			continue;
		}

		const indentedCode = indentedCodeBlock(arg);
		if(indentedCode !== null){
			const paraFlush = paragrafFlush(paragrafText, requestIndex);
			req = req.concat(paraFlush);
			paragrafText = "";

			req = req.concat(addRequestIndex(indentedCode.request, paraFlush, requestIndex));
			pointer = indentedCode.nextPointer;
			continue;
		}

		const quote = blockQuote(arg, arg.markdown, arg.pointer, 0);
		if(quote !== null){
			const paraFlush = paragrafFlush(paragrafText, requestIndex);
			req = req.concat(paraFlush);
			paragrafText = "";

			req = req.concat(addRequestIndex(quote.request, paraFlush, requestIndex));
			linkReferences = linkReferences.concat(quote.links);
			pointer = quote.nextPointer;
			continue;
		}

		const fencedCode = fencedCodeBlock(arg);
		if(fencedCode !== null){
			const paraFlush = paragrafFlush(paragrafText, requestIndex);
			req = req.concat(paraFlush);
			paragrafText = "";

			req = req.concat(addRequestIndex(fencedCode.request, paraFlush, requestIndex));
			pointer = fencedCode.nextPointer;
			continue;
		}

		const atx = atxHeading(arg);
		if(atx !== null){
			const paraFlush = paragrafFlush(paragrafText, requestIndex);
			req = req.concat(paraFlush);
			paragrafText = "";

			req = req.concat(addRequestIndex(atx.request, paraFlush, requestIndex));
			pointer = atx.nextPointer;
			continue;
		}
		
		if(isEmptyLine(markdown, pointer)){
			req = req.concat(paragrafFlush(paragrafText, requestIndex));
			paragrafText = "";
			pointer = nextLine(markdown, pointer);
			continue;
		}

		paragrafText += getTextInLine(markdown, pointer).trim() + "\n";
		pointer = nextLine(markdown, pointer);
	}

	return {
		requests: req,
		linkReferences: linkReferences,
		lastRequestIndex: requestIndex,
		extraText: paragrafText
	};
}

function paragrafFlush(text: string, reqIndex: number): docs_v1.Schema$Request[]{
	if(text === ""){
		return [];
	}
	return inlineText(text, reqIndex, 0, 0);
}

function thematicBreak({ markdown, pointer, reqIndex}: BlockArg): null | BlockReturn {
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
		const ret = new BlockReturn();
		ret.nextPointer = nextLine(markdown, pointer);
		return ret;
	}
	return null;
}

function atxHeading({ markdown, pointer, reqIndex, indented }: BlockArg): null | BlockReturn {
	const spaces = spacesLength(markdown, pointer + indented);
	if(3 < spaces.totalSpace()){
		return null;
	}

	let indexDelta = spaces.indexDelta() + indented;
	// pointer += spaces.indexDelta();
	const titleHashtags = charRepeatLenght(markdown, pointer + indexDelta, "#");
	if(0 === titleHashtags.chars || 6 < titleHashtags.chars){
		return null;
	}
	indexDelta += titleHashtags.chars;

	const afterSpaces = spacesLength(markdown, pointer + indexDelta);
	if(afterSpaces.indexDelta() === 0 && isNewLineChar(markdown, pointer + indexDelta) === 0){
		return null;
	}
	indexDelta += afterSpaces.indexDelta();

	let text = getTextInLine(markdown, pointer).slice(indexDelta);
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
			break;
		}
		if(text[i] !== " " && text[i] !== "\t"){
			hashTagRemove = 0;
		}
		break;
	}
	text = text.slice(0, text.length - hashTagRemove).trimEnd() + "\n";

	const ret = new BlockReturn();
	ret.request = inlineText(text, reqIndex, 0 , titleHashtags.chars);
	ret.nextPointer = nextLine(markdown, pointer);
	return ret;

}

function setextHeading({ markdown, pointer, paragraphBefore, reqIndex, indented }: BlockArg): null | BlockReturn {
	if(paragraphBefore === ""){
		return null;
	}

	const spaces = spacesLength(markdown, pointer + indented);
	if(3 < spaces.totalSpace()){
		return null;
	}
	pointer += spaces.indexDelta() + indented;

	const equelTitle = charRepeatLenght(markdown, pointer, "=");
	if(equelTitle.chars !== 0 && isEmptyLine(markdown, pointer + equelTitle.indexDelta()) !== 0){
		const ret = new BlockReturn();
		ret.request = inlineText(paragraphBefore, reqIndex, 0, 1);
	    ret.nextPointer = nextLine(markdown, pointer);
		return ret;
	}

	const hyphenTitle = charRepeatLenght(markdown, pointer, "=");
	if(hyphenTitle.chars !== 0 && isEmptyLine(markdown, pointer + hyphenTitle.indexDelta()) !== 0){
		const ret = new BlockReturn();
		ret.request = inlineText(paragraphBefore, reqIndex, 0, 2);
	    ret.nextPointer = nextLine(markdown, pointer);
		return ret;
	}

	return null;
}

function indentedCodeBlock({ markdown, pointer, paragraphBefore, reqIndex, indented }: BlockArg): null | BlockReturn {
	if(paragraphBefore !== ""){
		return null;
	}

	const spaces = spacesLength(markdown, pointer + indented);
	if(spaces.totalSpace() < 4){
		return null;
	}

	if(false){// FIXME: not a list
		return null;
	}

	let text = getTextInLine(markdown, pointer);
	text = text.slice(indented);
	text = mdHelper.IndentedCodeBlock.whitespaceRemove(text);

	let i = pointer;
	while(i < markdown.length){
		i = nextLine(markdown, i);

		if( isEmptyLine(markdown, i + indented) !== 0){
			text += "/n";

			continue;
		}

		const spaces = spacesLength(markdown, i + indented);
		if(spaces.totalSpace() < 4 ) {
			break;
		}

		let newText = getTextInLine(markdown, i);
		newText = newText.slice(indented);
		text += "/n" + mdHelper.IndentedCodeBlock.whitespaceRemove(newText);

		continue;
	}
	const ret = new BlockReturn();
	text = text.trim();
	ret.request = makeCodeBlockReq(text, reqIndex, 0);
	ret.nextPointer = nextLine(markdown, i);
	return ret;
}

function fencedCodeBlock({ markdown, pointer, reqIndex, indented }: BlockArg): null | BlockReturn {
	const markerSpaces = spacesLength(markdown, pointer + indented);
	if(3 < markerSpaces.totalSpace()) {
		return null;
	}
	pointer += markerSpaces.indexDelta() + indented;
	
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
	let i = nextLine(markdown, pointer);
	while (i < markdown.length){
		const spaces = spacesLength(markdown, i + indented);
		
		//end cheker
		if(spaces.totalSpace() <= 3){
			const repeatEndChar = charRepeatLenght(markdown, i + spaces.indexDelta() + indented, chars[0].char); 
			if(chars[0].repeat.chars <= repeatEndChar.chars && isEmptyLine(markdown, i + spaces.indexDelta() + repeatEndChar.chars) !== 0){
				break;
			}
		}

		let skipSpace: number = (spaces.indexDelta() <= markerSpaces.spaces) ? spaces.indexDelta() : markerSpaces.spaces;
		text += getTextInLine(markdown, i).slice(skipSpace + indented) + "\n";
		i = nextLine(markdown, i);
	}
	// if(text[text.length -1 ] === "\n"){
	// 	text = text.slice(0, text.length - 1);
	// }
	
	const ret = new BlockReturn();
	ret.request = makeCodeBlockReq(text, reqIndex, 0);
	ret.nextPointer = nextLine(markdown, i);
	return ret;
}

function htmlBlock({ markdown, pointer, paragraphBefore, reqIndex }: BlockArg): null | BlockReturn {
	return null;
	const ret = new BlockReturn();
	return ret;
}

function linkReferenceDefinition({ markdown, pointer, paragraphBefore, reqIndex }: BlockArg): null | BlockReturn {
	
	return null;
	const ret = new BlockReturn();
	return ret;
}

function blockQuote({ markdown, pointer, reqIndex }: BlockArg, rawMarkdown: string, rawPointer: number, indentation: number): null | ContainerBlockReturn {
	const spaces = spacesLength(markdown, pointer);
	if(3 < spaces.totalSpace()){
		return null;
	}

	// FIXME: add indentation suport. you can make the inserted markdown markders to be a specific length
	
	if(markdown[pointer + spaces.indexDelta()] !== ">"){
		return null;
	}
	
	const ret = new ContainerBlockReturn();
	let paragrafText = "";
	while(true){
		const rawArg = new BlockArg(rawMarkdown, rawPointer, "", reqIndex, indentation);
		if(isBlockQuotesIndentation(rawArg, indentation)){
			const text = makeBlockQuoteRequest(rawArg, indentation);
			let index = 0;
			while(index < text.length){
				const arg = new BlockArg(text, index, paragrafText, reqIndex, 0); // FIXME: change reqIndex
		
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

			const tArg = new BlockArg(getTextInLine(rawMarkdown, rawPointer).slice(remove), 0, "", reqIndex, indentation); // FIXME: change reqIndex
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

function makeBlockQuoteRequest({ markdown, pointer}: BlockArg, quotes: number){
	let text = "";
	while(pointer < markdown.length){
		let remove = blockQuotesCharRemove(new BlockArg(markdown, pointer, "", NaN, NaN), quotes);
		if(remove === 0){
			return text;
		}

		text += getTextInLine(markdown, pointer).slice(remove) + "\n";
		pointer = nextLine(markdown, pointer);
	}
	return text;
}

function bulletList({ markdown, pointer, paragraphBefore, reqIndex, indented }: BlockArg): null | ContainerBlockReturn {
	const spaces = spacesLength(markdown, pointer + indented);
	if(spaces.totalSpace() > 3){
		return null;
	}
	let indentation = spaces.indexDelta() + indented;
	
	const bulletListMarker = ["+", "-", "*"].find(x => x === markdown[pointer + indentation]);
	if(!bulletListMarker){
		return null;
	}
	indentation++;

	const afterSpaces = spacesLength(markdown, pointer + indentation);

	if(3 < afterSpaces.totalSpace()){
		indentation += 1;
	} else {
		// 0 1 2 3
		if(afterSpaces.totalSpace() === 0){
			if(isEmptyLine(markdown, pointer + indentation)){
				indentation += 1;
			} else {
				return null;
			}
		} else {
			indentation += afterSpaces.indexDelta();
		}
	}
	
	const ret = makeListRequest( markdown, nextLine(markdown, pointer),
		indentation, indented, 
		" ".repeat(indentation) + getTextInLine(markdown, pointer).slice(indentation)
	);

	ret.request.push({
		createParagraphBullets: {
			bulletPreset: listMarkerConverter(bulletListMarker),
			range: {
				startIndex: 1,
				endIndex: getLastRequestIndex(ret.request)
			}
		}
	});

	ret.request = moveRequestIndex(ret.request, reqIndex - 1);
	return ret;
}

function orderedList({ markdown, pointer, paragraphBefore, reqIndex, indented}: BlockArg): null | ContainerBlockReturn {
	const spaces = spacesLength(markdown, pointer + indented);
	
		if(spaces.totalSpace() > 3){
			return null;
		}
		let indentation = spaces.indexDelta() + indented;

	const ordetRegex = new RegExp(/[1-9]{1,9}[\.\)]{1}/);
	
	const regResult = ordetRegex.exec(getTextInLine(markdown, pointer + indentation));
	if(!regResult || ordetRegex.lastIndex !== 0){
		return null;
	}
	const listMarker = regResult[0];
	indentation += listMarker.length;

	const afterSpaces = spacesLength(markdown, pointer + indentation);

	if(3 < afterSpaces.totalSpace()){
		indentation += 1;
	} else {
		// 0 1 2 3
		if(afterSpaces.totalSpace() === 0){
			if(isEmptyLine(markdown, pointer + indentation)){
				indentation += 1;
			} else {
				return null;
			}
		} else {
			indentation += afterSpaces.indexDelta();
		}
	}
	
	const ret = makeListRequest( markdown, nextLine(markdown, pointer),
		indentation, indented, 
		" ".repeat(indentation) + getTextInLine(markdown, pointer).slice(indentation)
	);
	
	ret.request.push({
		createParagraphBullets: {
			bulletPreset: listMarkerConverter(listMarker[listMarker.length - 1]),
			range: {
				startIndex: 1,
				endIndex: getLastRequestIndex(ret.request)
			}
		}
	});

	ret.request = moveRequestIndex(ret.request, reqIndex - 1);
	return ret;
}

function makeListRequest(markdown: string, index: number, indentation: number, indented: number, firstLine: string){
	//let firstLine = " ".repeat(indentation) + getTextInLine(markdown, pointer).slice(indentation);
	//let index = nextLine(markdown, pointer);
	const ret = new ContainerBlockReturn();
	let paragrafText = "";
	while (true){ // TODO: Add lasy cotinue
		const list = listTextMaker(markdown, index, indentation - indented, indented, firstLine);
		firstLine = "";
		
		if(list.innerMarkdownText !== ""){
			const innerReq = convertMarkdown(list.innerMarkdownText, indentation, paragrafText);
			ret.request = ret.request.concat(moveRequestIndex(innerReq.requests, getLastRequestIndex(ret.request)));
			ret.links = ret.links.concat(innerReq.linkReferences);
			index = list.nextPointer;
			paragrafText = innerReq.extraText;
			
			//if() ?????
			continue;
		}
		
		if(isEmptyLine(markdown, index) !== 0){
			ret.request.concat(paragrafFlush(paragrafText, getLastRequestIndex(ret.request)));
			index = nextLine(markdown, index);
			continue;
		}

		
		if(paragrafText === "" && listParagraphContinuation(getTextInLine(markdown, index), indentation)){
			paragrafText += getTextInLine(markdown, index) + "\n";
		}
		
		const spaces = spacesLength(markdown, index);
		if(spaces.totalSpace() < indentation && isEmptyLine(markdown, index)){
			break;
		}
		break;
	}
	ret.request = ret.request.concat(paragrafFlush(paragrafText, getLastRequestIndex(ret.request)));
	ret.nextPointer = index;
	return ret;
}

function listTextMaker(markdown: string, pointer: number, removeSpace: number, indented: number, text: string){
	while(pointer < markdown.length){
		const space = spacesLength(markdown, pointer + indented);
		if(space.totalSpace() < removeSpace && isEmptyLine(markdown, pointer + indented) === 0){
			break;
		}
		if(text !== ""){
			text += "\n";
		}
		// text += getTextInLine(markdown, pointer).slice(removeSpace);
		text += getTextInLine(markdown, pointer);
		pointer = nextLine(markdown, pointer);
	}
	return {
		innerMarkdownText: text,
		nextPointer: pointer
	};
}

function listParagraphContinuation(text: string, indented: number): boolean {
	const tArg = new BlockArg(text, 0, "", 1, indented);
	return [
		thematicBreak(tArg),
		blockQuote(tArg, tArg.markdown, tArg.pointer, 0), 
		bulletList(tArg),
		orderedList(tArg),
		fencedCodeBlock(tArg),
		atxHeading(tArg),
	].every(x => x === null);
}

function listMarkerConverter(symbol: string){
	//https://developers.google.com/docs/api/reference/rest/v1/documents/request#bulletglyphpreset
	if(symbol === "*"){
		return "BULLET_DISC_CIRCLE_SQUARE";
	}
	if(symbol === "+"){
		return "BULLET_DIAMONDX_HOLLOWDIAMOND_SQUARE";
	}
	if(symbol === "-"){
		return "BULLET_ARROW_DIAMOND_DISC";
	}
	if(symbol === "."){
		return "NUMBERED_DECIMAL_ALPHA_ROMAN" ;
	}
	if(symbol === ")"){
		return "NUMBERED_DECIMAL_ALPHA_ROMAN_PARENS";
	}
	return "BULLET_GLYPH_PRESET_UNSPECIFIED";
}

function inlineText(text: string, reqIndex: number, indentation: number, headerType : number): docs_v1.Schema$Request[]{
	// https://googleapis.dev/nodejs/googleapis/latest/docs/interfaces/Schema$InsertTextRequest.html 

	//if()
	const ret = new Array<docs_v1.Schema$Request>();
	var paragrafStyle = inlineParagrafStyle(indentation, headerType);

	var insertText: docs_v1.Schema$InsertTextRequest = {
		text: text,
		location: {
			index: reqIndex
		}
	};

	paragrafStyle.range = {
		startIndex: reqIndex,
		endIndex: reqIndex + text.length
	};

	// ret.push({insertText: insertText});
	ret.push({insertText: insertText}, {updateParagraphStyle: paragrafStyle});

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
		fields: "namedStyleType, indentStart",
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

function makeCodeBlockReq(code: string, reqIndex: number, indentation: number): docs_v1.Schema$Request[]{
	const ret = new Array<docs_v1.Schema$Request>();
	ret.push({
		insertText: {
			text: code,
			location: {
				index: reqIndex
			}
		}
	}, {
		updateParagraphStyle: {
			fields: "namedStyleType, indentStart",
			range: {
				startIndex: reqIndex,
				endIndex: reqIndex + code.length
			},
			paragraphStyle: {
				indentStart: {
					magnitude: indentation,
					unit: "PT"
				}, // TODO: removed extra space betveen paragraf
				namedStyleType: "NORMAL_TEXT"
			}
		}
	}, {
		updateTextStyle: {
			fields: "weightedFontFamily",
			range: {
				startIndex: reqIndex,
				endIndex: reqIndex + code.length
			},
			textStyle: {
				weightedFontFamily: {
					fontFamily: "Roboto Mono",
					weight: 500
				}
			}
		}
	});
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

function isEmptyLine(markdown: string, index: number){ // returt zero if not an empty line
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
	return markdown.length;
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

function whitespaceChar(char: string){
	if(char === " "){
		return true;
	}
	if(char === "\t"){
		return true;
	}
	return false;
}

function getLastRequestIndex(request: Array<docs_v1.Schema$Request>): number {
	if(request.length === 0){
		return 1;
	}

	for (let i = request.length - 1; 0 <= i; i--) {
		const element = request[i];
		if(!element.insertText){
			continue;
		}
		if(!element.insertText.text){
			continue;
		}
		if(!element.insertText.location){
			continue;
		}
		if(!element.insertText.location.index){
			continue;
		}

		return element.insertText.location.index + element.insertText.text.length;
	}
	return -1;
}

function addRequestIndex(newRequest: Array<docs_v1.Schema$Request>, paragrafRequest: Array<docs_v1.Schema$Request>, reqIndex: number): Array<docs_v1.Schema$Request> {
	if(paragrafRequest.length === 0){
		return newRequest;
	}
	
	const shift = getLastRequestIndex(paragrafRequest) - reqIndex;
	return moveRequestIndex(newRequest, shift);
}

function moveRequestIndex(request: Array<docs_v1.Schema$Request>, shift: number): Array<docs_v1.Schema$Request> {
	if(shift === 0){
		return request;
	}
	request.forEach(x => {
		if(x.insertText && x.insertText.location && x.insertText.location.index){
			x.insertText.location.index += shift;
		}

		if(x.updateParagraphStyle && x.updateParagraphStyle.range){
			if(x.updateParagraphStyle.range.startIndex && x.updateParagraphStyle.range.endIndex){
				x.updateParagraphStyle.range.startIndex += shift;
				x.updateParagraphStyle.range.endIndex += shift;
			}
		}

		if(x.createParagraphBullets && x.createParagraphBullets.range){
			if(x.createParagraphBullets.range.startIndex && x.createParagraphBullets.range.endIndex){
				x.createParagraphBullets.range.startIndex += shift;
				x.createParagraphBullets.range.endIndex += shift;
			}
		}
	});

	return request;
}