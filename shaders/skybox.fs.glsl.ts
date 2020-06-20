export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec3 _pos;

uniform samplerCube env;

void main()
{
  color = vec4(textureLod(env, normalize(_pos), 0.5f).rgb, 1.0f);
}
`;
