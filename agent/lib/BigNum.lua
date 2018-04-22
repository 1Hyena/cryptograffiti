--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{1
--
--  File Name:              bignum.lua
--  Package Name:           BigNum 
--
--  Project:    Big Numbers library for Lua
--  Mantainers: fmp - Frederico Macedo Pessoa
--              msm - Marco Serpa Molinaro
--
--  History:
--     Version      Autor       Date            Notes
--      1.1      fmp/msm    12/11/2004   Some bug fixes (thanks Isaac Gouy)
--      alfa     fmp/msm    03/22/2003   Start of Development
--      beta     fmp/msm    07/11/2003   Release
--
--  Description:
--    Big numbers manipulation library for Lua.
--    A Big Number is a table with as many numbers as necessary to represent
--       its value in base 'RADIX'. It has a field 'len' containing the num-
--       ber of such numbers and a field 'signal' that may assume the values
--       '+' and '-'.
--
--$.%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


--%%%%%%%%  Constants used in the file %%%%%%%%--{{{1
local RADIX = 10^7 ;
local RADIX_LEN = math.floor( math.log10 ( RADIX ) ) ;



--printraw{{{2
local function printraw( bnum )
   local i = 0 ;
   if bnum == nil then
      error( "Function printraw: parameter nil" ) ;
   end
   while 1 == 1 do
      if bnum[i] == nil then
         io.write( ' len '..bnum.len ) ;
         if i ~= bnum.len then
            io.write( ' ERRO!!!!!!!!' ) ;
         end
         io.write( "\n" ) ;
         return 0 ;
      end
      io.write( 'r'..bnum[i] ) ;
      i = i + 1 ;
   end
end
--max{{{2
local function max( int1 , int2 )
   if int1 > int2 then
      return int1 ;
   else
      return int2 ;
   end
end

--decr{{{2
local function decr( bnum1 )
   local temp = {} ;
   temp = BigNum.new( "1" ) ;
   BigNum.sub( bnum1 , temp , bnum1 ) ;
   return 0 ;
end





--%%%%%%%%        Start of Code        %%%%%%%%--
BigNum = {} ;
BigNum.mt = {} ;





--BigNum.new{{{1
--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
--
--  Function: New 
--
--
--  Description:
--     Creates a new Big Number based on the parameter num.
--
--  Parameters:
--     num - a string, number or BigNumber.
--
--  Returns:
--     A Big Number, or a nil value if an error occured.
--
--
--  %%%%%%%% --

function BigNum.new( num ) --{{{2
   local bignum = {} ;
   setmetatable( bignum , BigNum.mt ) ;
   BigNum.change( bignum , num ) ;
   return bignum ;
end

--%%%%%%%%%%%%%%%%%%%% Functions for metatable %%%%%%%%%%%%%%%%%%%%--{{{1
--BigNum.mt.sub{{{2
function BigNum.mt.sub( num1 , num2 )
   local temp = BigNum.new() ;
   local bnum1 = BigNum.new( num1 ) ;
   local bnum2 = BigNum.new( num2 ) ;
   BigNum.sub( bnum1 , bnum2 , temp ) ;
   return temp ;
end

--BigNum.mt.add{{{2
function BigNum.mt.add( num1 , num2 )
   local temp = BigNum.new() ;
   local bnum1 = BigNum.new( num1 ) ;
   local bnum2 = BigNum.new( num2 ) ;
   BigNum.add( bnum1 , bnum2 , temp ) ;
   return temp ;
end

--BigNum.mt.mul{{{2
function BigNum.mt.mul( num1 , num2 )
   local temp = BigNum.new() ;
   local bnum1 = BigNum.new( num1 ) ;
   local bnum2 = BigNum.new( num2 ) ;
   BigNum.mul( bnum1 , bnum2 , temp ) ;
   return temp ;
end

--BigNum.mt.div{{{2
function BigNum.mt.div( num1 , num2 )
   local bnum1 = {} ;
   local bnum2 = {} ;
   local bnum3 = BigNum.new() ;
   local bnum4 = BigNum.new() ;
   bnum1 = BigNum.new( num1 ) ;
   bnum2 = BigNum.new( num2 ) ;
   BigNum.div( bnum1 , bnum2 , bnum3 , bnum4 ) ;
   return bnum3 , bnum4 ;
end

--BigNum.mt.tostring{{{2
function BigNum.mt.tostring( bnum )
   local i = 0 ;
   local j = 0 ;
   local str = "" ;
   local temp = "" ;
   if bnum == nil then
      return "nil" ;
   elseif bnum.len > 0 then
      for i = bnum.len - 2 , 0 , -1  do
         for j = 0 , RADIX_LEN - string.len( bnum[i] ) - 1 do
            temp = temp .. '0' ;
         end
         temp = temp .. bnum[i] ;
      end
      temp = bnum[bnum.len - 1] .. temp ;
      if bnum.signal == '-' then
         temp = bnum.signal .. temp ;
      end
      return temp ;
   else
      return "" ;
   end
end

--BigNum.mt.pow{{{2
function BigNum.mt.pow( num1 , num2 )
   local bnum1 = BigNum.new( num1 ) ;
   local bnum2 = BigNum.new( num2 ) ;
   return BigNum.pow( bnum1 , bnum2 ) ;
end

--BigNum.mt.eq{{{2
function BigNum.mt.eq( num1 , num2 )
   local bnum1 = BigNum.new( num1 ) ;
   local bnum2 = BigNum.new( num2 ) ;
   return BigNum.eq( bnum1 , bnum2 ) ;
end

--BigNum.mt.lt{{{2
function BigNum.mt.lt( num1 , num2 )
   local bnum1 = BigNum.new( num1 ) ;
   local bnum2 = BigNum.new( num2 ) ;
   return BigNum.lt( bnum1 , bnum2 ) ;
end

--BigNum.mt.le{{{2
function BigNum.mt.le( num1 , num2 )
   local bnum1 = BigNum.new( num1 ) ;
   local bnum2 = BigNum.new( num2 ) ;
   return BigNum.le( bnum1 , bnum2 ) ;
end

--BigNum.mt.unm{{{2
function BigNum.mt.unm( num )
   local ret = BigNum.new( num )
   if ret.signal == '+' then
      ret.signal = '-'
   else
      ret.signal = '+'
   end
   return ret
end

--%%%%%%%%%%%%%%%%%%%% Metatable Definitions %%%%%%%%%%%%%%%%%%%%--{{{1

BigNum.mt.__metatable = "hidden"           ; -- answer to getmetatable(aBignum)
-- BigNum.mt.__index     = "inexistent field" ; -- attempt to acess nil valued field 
-- BigNum.mt.__newindex  = "not available"    ; -- attempt to create new field
BigNum.mt.__tostring  = BigNum.mt.tostring ;
-- arithmetics
BigNum.mt.__add = BigNum.mt.add ;
BigNum.mt.__sub = BigNum.mt.sub ;
BigNum.mt.__mul = BigNum.mt.mul ;
BigNum.mt.__div = BigNum.mt.div ;
BigNum.mt.__pow = BigNum.mt.pow ;
BigNum.mt.__unm = BigNum.mt.unm ;
-- Comparisons
BigNum.mt.__eq = BigNum.mt.eq   ; 
BigNum.mt.__le = BigNum.mt.le   ;
BigNum.mt.__lt = BigNum.mt.lt   ;
--concatenation
-- BigNum.me.__concat = ???

setmetatable( BigNum.mt, { __index = "inexistent field", __newindex = "not available", __metatable="hidden" } ) ;

--%%%%%%%%%%%%%%%%%%%% Basic Functions %%%%%%%%%%%%%%%%%%%%--{{{1
--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{2
--
--  Function: ADD 
--
--
--  Description:
--     Adds two Big Numbers.
--
--  Parameters:
--     bnum1, bnum2 - Numbers to be added.
--     bnum3 - result
--
--  Returns:
--     0
--
--  Exit assertions:
--     bnum3 is the result of the sum.
--
--  %%%%%%%% --
--Funcao BigNum.add{{{2
function BigNum.add( bnum1 , bnum2 , bnum3 )
   local maxlen = 0 ;
   local i = 0 ;
   local carry = 0 ;
   local signal = '+' ;
   local old_len = 0 ;
   --Handle the signals
   if bnum1 == nil or bnum2 == nil or bnum3 == nil then
      error("Function BigNum.add: parameter nil") ;
   elseif bnum1.signal == '-' and bnum2.signal == '+' then
      bnum1.signal = '+' ;
      BigNum.sub( bnum2 , bnum1 , bnum3 ) ;

      if not rawequal(bnum1, bnum3) then
         bnum1.signal = '-' ;
      end
      return 0 ;
   elseif bnum1.signal == '+' and bnum2.signal == '-' then   
      bnum2.signal = '+' ;
      BigNum.sub( bnum1 , bnum2 , bnum3 ) ;
      if not rawequal(bnum2, bnum3) then
         bnum2.signal = '-' ;
      end
      return 0 ;
   elseif bnum1.signal == '-' and bnum2.signal == '-' then
      signal = '-' ;
   end
   --
   old_len = bnum3.len ;
   if bnum1.len > bnum2.len then
      maxlen = bnum1.len ;
   else
      maxlen = bnum2.len ;
      bnum1 , bnum2 = bnum2 , bnum1 ;
   end
   --School grade sum
   for i = 0 , maxlen - 1 do
      if bnum2[i] ~= nil then
         bnum3[i] = bnum1[i] + bnum2[i] + carry ;
      else
         bnum3[i] = bnum1[i] + carry ;
      end
      if bnum3[i] >= RADIX then
         bnum3[i] = bnum3[i] - RADIX ;
         carry = 1 ;
      else
         carry = 0 ;
      end
   end
   --Update the answer's size
   if carry == 1 then
      bnum3[maxlen] = 1 ;
   end
   bnum3.len = maxlen + carry ;
   bnum3.signal = signal ;
   for i = bnum3.len, old_len do
      bnum3[i] = nil ;
   end
   return 0 ;
end


--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{2
--
--  Function: SUB 
--
--
--  Description:
--     Subtracts two Big Numbers.
--
--  Parameters:
--     bnum1, bnum2 - Numbers to be subtracted.
--     bnum3 - result
--
--  Returns:
--     0
--
--  Exit assertions:
--     bnum3 is the result of the subtraction.
--
--  %%%%%%%% --
--Funcao BigNum.sub{{{2
function BigNum.sub( bnum1 , bnum2 , bnum3 )
   local maxlen = 0 ;
   local i = 0 ;
   local carry = 0 ;
   local old_len = 0 ;
   --Handle the signals
   
   if bnum1 == nil or bnum2 == nil or bnum3 == nil then
      error("Function BigNum.sub: parameter nil") ;
   elseif bnum1.signal == '-' and bnum2.signal == '+' then
      bnum1.signal = '+' ;
      BigNum.add( bnum1 , bnum2 , bnum3 ) ;
      bnum3.signal = '-' ;
      if not rawequal(bnum1, bnum3) then
         bnum1.signal = '-' ;
      end
      return 0 ;
   elseif bnum1.signal == '-' and bnum2.signal == '-' then
      bnum1.signal = '+' ;
      bnum2.signal = '+' ;
      BigNum.sub( bnum2, bnum1 , bnum3 ) ;
      if not rawequal(bnum1, bnum3) then
         bnum1.signal = '-' ;
      end
      if not rawequal(bnum2, bnum3) then
         bnum2.signal = '-' ;
      end
      return 0 ;
   elseif bnum1.signal == '+' and bnum2.signal == '-' then
      bnum2.signal = '+' ;
      BigNum.add( bnum1 , bnum2 , bnum3 ) ;
      if not rawequal(bnum2, bnum3) then
         bnum2.signal = '-' ;
      end
      return 0 ;
   end
   --Tests if bnum2 > bnum1
   if BigNum.compareAbs( bnum1 , bnum2 ) == 2 then
      BigNum.sub( bnum2 , bnum1 , bnum3 ) ;
      bnum3.signal = '-' ;
      return 0 ;
   else
      maxlen = bnum1.len ;
   end
   old_len = bnum3.len ;
   bnum3.len = 0 ;
   --School grade subtraction
   for i = 0 , maxlen - 1 do
      if bnum2[i] ~= nil then
         bnum3[i] = bnum1[i] - bnum2[i] - carry ;
      else
         bnum3[i] = bnum1[i] - carry ;
      end
      if bnum3[i] < 0 then
         bnum3[i] = RADIX + bnum3[i] ;
         carry = 1 ;
      else
         carry = 0 ;
      end

      if bnum3[i] ~= 0 then
         bnum3.len = i + 1 ;
      end
   end
   bnum3.signal = '+' ;
   --Check if answer's size if zero
   if bnum3.len == 0 then
      bnum3.len = 1 ;
      bnum3[0]  = 0 ;
   end
   if carry == 1 then
      error( "Error in function sub" ) ;
   end
   for i = bnum3.len , max( old_len , maxlen - 1 ) do
      bnum3[i] = nil ;
   end
   return 0 ;
end


--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{2
--
--  Function: MUL 
--
--
--  Description:
--     Multiplies two Big Numbers.
--
--  Parameters:
--     bnum1, bnum2 - Numbers to be multiplied.
--     bnum3 - result
--
--  Returns:
--     0
--
--  Exit assertions:
--     bnum3 is the result of the multiplication.
--
--  %%%%%%%% --
--BigNum.mul{{{2
--can't be made in place
function BigNum.mul( bnum1 , bnum2 , bnum3 )
   local i = 0 ; j = 0 ;
   local temp = BigNum.new( ) ;
   local temp2 = 0 ;
   local carry = 0 ;
   local oldLen = bnum3.len ;
   if bnum1 == nil or bnum2 == nil or bnum3 == nil then
      error("Function BigNum.mul: parameter nil") ;
   --Handle the signals
   elseif bnum1.signal ~= bnum2.signal then
      BigNum.mul( bnum1 , -bnum2 , bnum3 ) ;
      bnum3.signal = '-' ;
      return 0 ;
   end
   bnum3.len =  ( bnum1.len ) + ( bnum2.len ) ;
   --Fill with zeros
   for i = 1 , bnum3.len do
      bnum3[i - 1] = 0 ;
   end
   --Places nil where passes through this
   for i = bnum3.len , oldLen do
      bnum3[i] = nil ;
   end
   --School grade multiplication
   for i = 0 , bnum1.len - 1 do
      for j = 0 , bnum2.len - 1 do
         carry =  ( bnum1[i] * bnum2[j] + carry ) ;
         carry = carry + bnum3[i + j] ;
         --bnum3[i + j] = math.mod ( carry , RADIX ) ;
         bnum3[i + j] = carry % RADIX ;
         temp2 = bnum3[i + j] ;
         carry =  math.floor ( carry / RADIX ) ;
      end
      if carry ~= 0 then
         bnum3[i + bnum2.len] = carry ;
      end
      carry = 0 ;
   end

   --Update the answer's size
   for i = bnum3.len - 1 , 1 , -1 do
      if bnum3[i] ~= nil and bnum3[i] ~= 0 then
         break ;
      else
         bnum3[i] = nil ;
      end
      bnum3.len = bnum3.len - 1 ;
   end
   return 0 ; 
end


--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{2
--
--  Function: DIV 
--
--
--  Description:
--     Divides bnum1 by bnum2.
--
--  Parameters:
--     bnum1, bnum2 - Numbers to be divided.
--     bnum3 - result
--     bnum4 - remainder
--
--  Returns:
--     0
--
--  Exit assertions:
--     bnum3 is the result of the division.
--     bnum4 is the remainder of the division.
--
--  %%%%%%%% --
--BigNum.div{{{2
function BigNum.div( bnum1 , bnum2 , bnum3 , bnum4 )
   local temp = BigNum.new() ;
   local temp2 = BigNum.new() ;
   local one = BigNum.new( "1" ) ;
   local zero = BigNum.new( "0" ) ;
   --Check division by zero
   if BigNum.compareAbs( bnum2 , zero ) == 0 then
      error( "Function BigNum.div: Division by zero" ) ;
   end     
   --Handle the signals
   if bnum1 == nil or bnum2 == nil or bnum3 == nil or bnum4 == nil then
      error( "Function BigNum.div: parameter nil" ) ;
   elseif bnum1.signal == "+" and bnum2.signal == "-" then
      bnum2.signal = "+" ;
      BigNum.div( bnum1 , bnum2 , bnum3 , bnum4 ) ;
      bnum2.signal = "-" ;
      bnum3.signal = "-" ;
      return 0 ;
   elseif bnum1.signal == "-" and bnum2.signal == "+" then
      bnum1.signal = "+" ;
      BigNum.div( bnum1 , bnum2 , bnum3 , bnum4 ) ;
      bnum1.signal = "-" ;
      if bnum4 < zero then --Check if remainder is negative
         BigNum.add( bnum3 , one , bnum3 ) ;
         BigNum.sub( bnum2 , bnum4 , bnum4 ) ;
      end
      bnum3.signal = "-" ;
      return 0 ;
   elseif bnum1.signal == "-" and bnum2.signal == "-" then
      bnum1.signal = "+" ;
      bnum2.signal = "+" ;
      BigNum.div( bnum1 , bnum2 , bnum3 , bnum4 ) ;
      bnum1.signal = "-" ;
      if bnum4 < zero then --Check if remainder is negative      
         BigNum.add( bnum3 , one , bnum3 ) ;
         BigNum.sub( bnum2 , bnum4 , bnum4 ) ;
      end
      bnum2.signal = "-" ;
      return 0 ;
   end
   temp.len = bnum1.len - bnum2.len - 1 ;

   --Reset variables
   BigNum.change( bnum3 , "0" ) ;
   BigNum.change( bnum4 , "0" ) ; 

   BigNum.copy( bnum1 , bnum4 ) ;

   --Check if can continue dividing
   while( BigNum.compareAbs( bnum4 , bnum2 ) ~= 2 ) do
      if bnum4[bnum4.len - 1] >= bnum2[bnum2.len - 1] then
         BigNum.put( temp , math.floor( bnum4[bnum4.len - 1] / bnum2[bnum2.len - 1] ) , bnum4.len - bnum2.len ) ;
         temp.len = bnum4.len - bnum2.len + 1 ;
      else
         BigNum.put( temp , math.floor( ( bnum4[bnum4.len - 1] * RADIX + bnum4[bnum4.len - 2] ) / bnum2[bnum2.len -1] ) , bnum4.len - bnum2.len - 1 ) ;
         temp.len = bnum4.len - bnum2.len ;
      end
    
      if bnum4.signal ~= bnum2.signal then
         temp.signal = "-";
      else
         temp.signal = "+";
      end
      BigNum.add( temp , bnum3 , bnum3 )  ;
      temp = temp * bnum2 ;
      BigNum.sub( bnum4 , temp , bnum4 ) ;
   end

   --Update if the remainder is negative
   if bnum4.signal == '-' then
      decr( bnum3 ) ;
      BigNum.add( bnum2 , bnum4 , bnum4 ) ;
   end
   return 0 ;
end

--%%%%%%%%%%%%%%%%%%%% Compound Functions %%%%%%%%%%%%%%%%%%%%--{{{1

--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{2
--
--  Function: POW / EXP  
--
--
--  Description:
--     Computes a big number which represents the bnum2-th power of bnum1.
--
--  Parameters:
--     bnum1 - base
--     bnum2 - expoent
--
--  Returns:
--     Returns a big number which represents the bnum2-th power of bnum1.
--
--  %%%%%%%% --
--BigNum.exp{{{2
function BigNum.pow( bnum1 , bnum2 )
   local n = BigNum.new( bnum2 ) ;
   local y = BigNum.new( 1 ) ;
   local z = BigNum.new( bnum1 ) ;
   local zero = BigNum.new( "0" ) ;
   if bnum2 < zero then
      error( "Function BigNum.exp: domain error" ) ;
   elseif bnum2 == zero then
      return y ;
   end
   while 1 do
      if  n[0] % 2  == 0 then
         n = n / 2 ;
      else
         n = n / 2 ;
         y = z * y  ;
         if n == zero then
            return y ;
         end
      end
      z = z * z ;
   end
end
-- Portugus :
BigNum.exp = BigNum.pow

--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{2
--
--  Function: GCD / MMC
--
--
--  Description:
--     Computes the greatest commom divisor of bnum1 and bnum2.
--
--  Parameters:
--     bnum1, bnum2 - positive numbers
--
--  Returns:
--     Returns a big number witch represents the gcd between bnum1 and bnum2.
--
--  %%%%%%%% --
--BigNum.gcd{{{2
function BigNum.gcd( bnum1 , bnum2 )
   local a = {} ;
   local b = {} ;
   local c = {} ;
   local d = {} ;
   local zero = {} ;
   zero = BigNum.new( "0" ) ;
   if bnum1 == zero or bnum2 == zero then
      return BigNum.new( "1" ) ;
   end
   a = BigNum.new( bnum1 ) ;
   b = BigNum.new( bnum2 ) ;
   a.signal = '+' ;
   b.signal = '+' ;
   c = BigNum.new() ;
   d = BigNum.new() ;
   while b > zero do
      BigNum.div( a , b , c , d ) ;
      a , b , d = b , d , a ;
   end
   return a ;
end
-- Portugus: 
BigNum.mmc = BigNum.gcd

--%%%%%%%%%%%%%%%%%%%% Comparison Functions %%%%%%%%%%%%%%%%%%%%--{{{1

--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{2
--
--  Function: EQ
--
--
--  Description:
--     Compares two Big Numbers.
--
--  Parameters:
--     bnum1, bnum2 - numbers
--
--  Returns:
--     Returns true if they are equal or false otherwise.
--
--  %%%%%%%% --
--BigNum.eq{{{2
function BigNum.eq( bnum1 , bnum2 )
   if BigNum.compare( bnum1 , bnum2 ) == 0 then
      return true ;
   else
      return false ;
   end
end

--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{2
--
--  Function: LT
--
--
--  Description:
--     Verifies if bnum1 is lesser than bnum2.
--
--  Parameters:
--     bnum1, bnum2 - numbers
--
--  Returns:
--     Returns true if bnum1 is lesser than bnum2 or false otherwise.
--
--  %%%%%%%% --
--BigNum.lt{{{2
function BigNum.lt( bnum1 , bnum2 )
   if BigNum.compare( bnum1 , bnum2 ) == 2 then
      return true ;
   else
      return false ;
   end
end


--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{2
--
--  Function: LE
--
--
--  Description:
--     Verifies if bnum1 is lesser or equal than bnum2.
--
--  Parameters:
--     bnum1, bnum2 - numbers
--
--  Returns:
--     Returns true if bnum1 is lesser or equal than bnum2 or false otherwise.
--
--  %%%%%%%% --
--BigNum.le{{{2
function BigNum.le( bnum1 , bnum2 )
   local temp = -1 ;
   temp = BigNum.compare( bnum1 , bnum2 )
   if temp == 0 or temp == 2 then
      return true ;
   else
      return false ;
   end
end

--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{2
--
--  Function: Compare Absolute Values
--
--
--  Description:
--     Compares absolute values of bnum1 and bnum2.
--
--  Parameters:
--     bnum1, bnum2 - numbers
--
--  Returns:
--     1 - |bnum1| > |bnum2|
--     2 - |bnum1| < |bnum2|
--     0 - |bnum1| = |bnum2|
--
--  %%%%%%%% --
--BigNum.compareAbs{{{2
function BigNum.compareAbs( bnum1 , bnum2 )
   if bnum1 == nil or bnum2 == nil then
      error("Function compare: parameter nil") ;
   elseif bnum1.len > bnum2.len then
      return 1 ;
   elseif bnum1.len < bnum2.len then
      return 2 ;
   else
      local i ;
      for i = bnum1.len - 1 , 0 , -1 do
         if bnum1[i] > bnum2[i] then
            return 1 ;
         elseif bnum1[i] < bnum2[i] then
            return 2 ;
         end
      end
   end
   return 0 ;
end


--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{2
--
--  Function: Compare 
--
--
--  Description:
--     Compares values of bnum1 and bnum2.
--
--  Parameters:
--     bnum1, bnum2 - numbers
--
--  Returns:
--     1 - |bnum1| > |bnum2|
--     2 - |bnum1| < |bnum2|
--     0 - |bnum1| = |bnum2|
--
--  %%%%%%%% --
--BigNum.compare{{{2
function BigNum.compare( bnum1 , bnum2 )
   local signal = 0 ;
   
   if bnum1 == nil or bnum2 == nil then
      error("Funtion BigNum.compare: parameter nil") ;
   elseif bnum1.signal == '+' and bnum2.signal == '-' then
      return 1 ;
   elseif bnum1.signal == '-' and bnum2.signal == '+' then
      return 2 ;
   elseif bnum1.signal == '-' and bnum2.signal == '-' then
      signal = 1 ;
   end
   if bnum1.len > bnum2.len then
      return 1 + signal ;
   elseif bnum1.len < bnum2.len then
      return 2 - signal ;
   else
      local i ;
      for i = bnum1.len - 1 , 0 , -1 do
         if bnum1[i] > bnum2[i] then
            return 1 + signal ;
	 elseif bnum1[i] < bnum2[i] then
	    return 2 - signal ;
	 end
      end
   end
   return 0 ;
end         


--%%%%%%%%%%%%%%%%%%%% Low level Functions %%%%%%%%%%%%%%%%%%%%--{{{1
--BigNum.copy{{{2
function BigNum.copy( bnum1 , bnum2 )
   if bnum1 ~= nil and bnum2 ~= nil then
      local i ;
      for i = 0 , bnum1.len - 1 do
         bnum2[i] = bnum1[i] ;
      end
      bnum2.len = bnum1.len ;
   else
      error("Function BigNum.copy: parameter nil") ;
   end
end


--%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%{{{2
--
--  Function: Change
--
--  Description:
--     Changes the value of a BigNum.
--     This function is called by BigNum.new.
--
--  Parameters:
--     bnum1, bnum2 - numbers
--
--  Returns:
--     1 - |bnum1| > |bnum2|
--     2 - |bnum1| < |bnum2|
--     0 - |bnum1| = |bnum2|
--
--  %%%%%%%% --
--BigNum.change{{{2
function BigNum.change( bnum1 , num )
   local j = 0 ;
   local len = 0  ;
   local num = num ;
   local l ;
   local oldLen = 0 ;
   if bnum1 == nil then
      error( "BigNum.change: parameter nil" ) ;
   elseif type( bnum1 ) ~= "table" then
      error( "BigNum.change: parameter error, type unexpected" ) ;
   elseif num == nil then
      bnum1.len = 1 ;
      bnum1[0] = 0 ;
      bnum1.signal = "+";
   elseif type( num ) == "table" and num.len ~= nil then  --check if num is a big number
      --copy given table to the new one
      for i = 0 , num.len do
         bnum1[i] = num[i] ;
      end
      if num.signal ~= '-' and num.signal ~= '+' then
         bnum1.signal = '+' ;
      else
         bnum1.signal = num.signal ;
      end
      oldLen = bnum1.len ;
      bnum1.len = num.len ;
   elseif type( num ) == "string" or type( num ) == "number" then
      if string.sub( num , 1 , 1 ) == '+' or string.sub( num , 1 , 1 ) == '-' then
         bnum1.signal = string.sub( num , 1 , 1 ) ;
         num = string.sub(num, 2) ;
      else
         bnum1.signal = '+' ;
      end
      num = string.gsub( num , " " , "" ) ;
      local sf = string.find( num , "e" ) ;
      --Handles if the number is in exp notation
      if sf ~= nil then
         num = string.gsub( num , "%." , "" ) ;
         local e = string.sub( num , sf + 1 ) ;
         e = tonumber(e) ;
         if e ~= nil and e > 0 then 
            e = tonumber(e) ;
         else
            error( "Function BigNum.change: string is not a valid number" ) ;
         end
         num = string.sub( num , 1 , sf - 2 ) ;
         for i = string.len( num ) , e do
            num = num .. "0" ;
         end
      else
         sf = string.find( num , "%." ) ;
         if sf ~= nil then
            num = string.sub( num , 1 , sf - 1 ) ;
         end
      end

      l = string.len( num ) ;
      oldLen = bnum1.len ;
      if (l > RADIX_LEN) then
         local mod = l-( math.floor( l / RADIX_LEN ) * RADIX_LEN ) ;
         for i = 1 , l-mod, RADIX_LEN do
            bnum1[j] = tonumber( string.sub( num, -( i + RADIX_LEN - 1 ) , -i ) );
            --Check if string dosn't represents a number
            if bnum1[j] == nil then
               error( "Function BigNum.change: string is not a valid number" ) ;
               bnum1.len = 0 ;
               return 1 ;
            end
            j = j + 1 ; 
            len = len + 1 ;
         end
         if (mod ~= 0) then
            bnum1[j] = tonumber( string.sub( num , 1 , mod ) ) ;
            bnum1.len = len + 1 ;
         else
            bnum1.len = len ;            
         end
         --Eliminate trailing zeros
         for i = bnum1.len - 1 , 1 , -1 do
            if bnum1[i] == 0 then
               bnum1[i] = nil ;
               bnum1.len = bnum1.len - 1 ;
            else
               break ;
            end
         end
         
      else     
         -- string.len(num) <= RADIX_LEN
         bnum1[j] = tonumber( num ) ;
         bnum1.len = 1 ;
      end
   else
      error( "Function BigNum.change: parameter error, type unexpected" ) ;
   end

   --eliminates the deprecated higher order 'algarisms'
   if oldLen ~= nil then
      for i = bnum1.len , oldLen do
         bnum1[i] = nil ;
      end
   end

   return 0 ;
end 

--BigNum.put{{{2
--Places int in the position pos of bignum, fills before with zeroes and
--after with nil.
function BigNum.put( bnum , int , pos )
   if bnum == nil then
      error("Function BigNum.put: parameter nil") ;
   end
   local i = 0 ;
   for i = 0 , pos - 1 do
      bnum[i] = 0 ;
   end
   bnum[pos] = int ;
   for i = pos + 1 , bnum.len do
      bnum[i] = nil ;
   end
   bnum.len = pos ;
   return 0 ;
end

