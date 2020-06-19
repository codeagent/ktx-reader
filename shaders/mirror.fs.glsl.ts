export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec3 _normal;
in vec3 _pos;

uniform samplerCube env;
uniform vec3 pos;

void main()
{
  vec3 v = normalize(_pos - pos);
  vec3 r = reflect(v, _normal);
  color = vec4(_normal * 0.5f + 0.5f, 1.0f); 
  color = vec4(texture(env, r, 2.0f).rgb, 1.0f);
}
`;